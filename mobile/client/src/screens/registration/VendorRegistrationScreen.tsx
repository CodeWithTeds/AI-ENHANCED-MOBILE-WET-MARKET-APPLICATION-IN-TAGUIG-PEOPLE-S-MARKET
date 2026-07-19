/**
 * VendorRegistrationScreen — orchestrates the multi-step vendor registration flow.
 * 
 * Steps:
 * 1. Personal Information
 * 2. Business Information
 * 3. Document Uploads
 * 4. Review & Submit
 * 5. Success (post-submit)
 */

import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StepIndicator } from '@/components/registration/StepIndicator';
import { StepPersonalInfo } from './StepPersonalInfo';
import { StepBusinessInfo } from './StepBusinessInfo';
import { StepDocuments } from './StepDocuments';
import { StepReview } from './StepReview';
import { SuccessScreen } from './SuccessScreen';
import { registerVendor } from '@/services/vendor-registration';
import { ApiError } from '@/services/api';
import { Colors } from '@/constants/colors';
import type {
  BusinessInfo,
  DocumentsInfo,
  PersonalInfo,
  VendorRegistrationData,
} from '@/types/vendor';

const TOTAL_STEPS = 4;

const initialPersonal: PersonalInfo = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

const initialBusiness: BusinessInfo = {
  stallName: '',
  stallId: null,
  sectionId: null,
  productCategories: [],
};

const initialDocuments: DocumentsInfo = {
  businessPermit: null,
  stallLease: null,
  validId: null,
};

export default function VendorRegistrationScreen() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>(initialPersonal);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(initialBusiness);
  const [documentsInfo, setDocumentsInfo] = useState<DocumentsInfo>(initialDocuments);

  function handlePersonalNext(data: PersonalInfo) {
    setPersonalInfo(data);
    setCurrentStep(2);
  }

  function handleBusinessNext(data: BusinessInfo) {
    setBusinessInfo(data);
    setCurrentStep(3);
  }

  function handleDocumentsNext(data: DocumentsInfo) {
    setDocumentsInfo(data);
    setCurrentStep(4);
  }

  function goBack() {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  }

  async function handleSubmit() {
    setIsSubmitting(true);

    const registrationData: VendorRegistrationData = {
      personal: personalInfo,
      business: businessInfo,
      documents: documentsInfo,
    };

    try {
      await registerVendor(registrationData);
      setIsComplete(true);
    } catch (error) {
      if (error instanceof ApiError) {
        const validationErrors = (error.data as { errors?: Record<string, string[]> })?.errors;
        if (validationErrors) {
          const messages = Object.values(validationErrors).flat().join('\n');
          Alert.alert('Validation Error', messages);
        } else {
          Alert.alert('Registration Failed', error.message);
        }
      } else {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        Alert.alert('Error', msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleGoHome() {
    // Reset everything — in a full app, navigate to home screen
    setCurrentStep(1);
    setPersonalInfo(initialPersonal);
    setBusinessInfo(initialBusiness);
    setDocumentsInfo(initialDocuments);
    setIsComplete(false);
  }

  if (isComplete) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <SuccessScreen onGoHome={handleGoHome} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <StepIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />

        <View style={styles.stepContent}>
          {currentStep === 1 && (
            <StepPersonalInfo data={personalInfo} onNext={handlePersonalNext} />
          )}
          {currentStep === 2 && (
            <StepBusinessInfo
              data={businessInfo}
              onNext={handleBusinessNext}
              onBack={goBack}
            />
          )}
          {currentStep === 3 && (
            <StepDocuments
              data={documentsInfo}
              onNext={handleDocumentsNext}
              onBack={goBack}
            />
          )}
          {currentStep === 4 && (
            <StepReview
              data={{ personal: personalInfo, business: businessInfo, documents: documentsInfo }}
              onSubmit={handleSubmit}
              onBack={goBack}
              loading={isSubmitting}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
  },
});
