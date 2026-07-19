/**
 * Vendor registration types — step-by-step form data.
 */

export interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

export interface BusinessInfo {
  stallName: string;
  stallLocation: string;
  productCategories: string[];
}

export interface DocumentUpload {
  uri: string;
  name: string;
  type: string;
}

export interface DocumentsInfo {
  businessPermit: DocumentUpload | null;
  stallLease: DocumentUpload | null;
  validId: DocumentUpload | null;
}

export interface VendorRegistrationData {
  personal: PersonalInfo;
  business: BusinessInfo;
  documents: DocumentsInfo;
}

export type VendorStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface VendorProfile {
  id: number;
  userId: number;
  stallName: string;
  stallLocation: string;
  productCategories: string[];
  status: VendorStatus;
  rejectionReason: string | null;
  approvedAt: string | null;
  documents: VendorDocumentResponse[];
}

export interface VendorDocumentResponse {
  id: number;
  documentType: string;
  filePath: string;
  originalName: string;
}

export interface VendorRegistrationResponse {
  status: string;
  message: string;
  data: {
    access_token: string;
    token_type: string;
    user: {
      id: number;
      name: string;
      email: string | null;
    };
    vendor: VendorProfile;
  };
}

export const PRODUCT_CATEGORIES = [
  'Meat',
  'Fish',
  'Vegetables',
  'Fruits',
  'Spices',
  'Poultry',
  'Seafood',
  'Dairy',
  'Grains & Rice',
  'Condiments',
] as const;

export const STALL_LOCATIONS = [
  'Meat Section',
  'Fish Section',
  'Vegetable Section',
  'Fruit Section',
  'Dry Goods Section',
  'Spices Section',
  'General Section',
] as const;
