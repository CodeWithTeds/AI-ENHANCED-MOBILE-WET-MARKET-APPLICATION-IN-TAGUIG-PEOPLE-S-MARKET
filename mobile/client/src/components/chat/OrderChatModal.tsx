/**
 * OrderChatModal — In-App Customer-Vendor Messaging Interface
 *
 * Designed to address Cash on Delivery (COD) uncollected orders by:
 *  - Enabling direct order-linked chat between customer and vendor
 *  - Allowing vendor to request order confirmation before preparing perishable goods
 *  - Allowing customer to Confirm, Cancel, or Clarify their orders in real-time
 *  - Retaining chat history for dispute resolution
 *  - Providing responsive layout for both Desktop / Web and Mobile
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  cancelOrderChat,
  confirmOrderChat,
  getOrderChat,
  markChatRead,
  requestOrderConfirmation,
  sendChatMessage,
  type ConfirmationStatus,
  type OrderChatMessage,
  type OrderConversation,
} from '@/services/chat';
import { realtimeService } from '@/services/echo';
import { ApiError } from '@/services/api';

interface OrderChatModalProps {
  visible: boolean;
  orderId: number;
  vendorId: number;
  token: string;
  userRole: 'customer' | 'vendor';
  stallName?: string;
  orderNumber?: string;
  isCod?: boolean;
  onClose: () => void;
  onStatusUpdated?: (newStatus: string) => void;
}

const CUSTOMER_QUICK_CLARIFICATIONS = [
  'Confirming! Please prepare my order.',
  'What time will this be ready for pickup?',
  'Please pack items into separate bags.',
  'Are all meats/veggies freshly cut today?',
];

const VENDOR_QUICK_CLARIFICATIONS = [
  'Items are freshly prepared and packed!',
  'Please confirm your COD order so we can butcher the meat.',
  'Your order is ready for pickup at our stall.',
  'Will you be picking this up before 12:00 PM?',
];

export const OrderChatModal: React.FC<OrderChatModalProps> = ({
  visible,
  orderId,
  vendorId,
  token,
  userRole,
  stallName,
  orderNumber,
  isCod = true,
  onClose,
  onStatusUpdated,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isDesktop = windowWidth >= 768;

  const [conversation, setConversation] = useState<OrderConversation | null>(null);
  const [messages, setMessages] = useState<OrderChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scrollViewRef = useRef<any>(null);

  const fetchChat = useCallback(async () => {
    if (!orderId || !vendorId || !token) return;
    try {
      const conv = await getOrderChat(orderId, vendorId, token);
      setConversation(conv);
      setMessages(conv.messages ?? []);
      if (conv.id) {
        markChatRead(conv.id, token);
      }
      setErrorMessage(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not load chat.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }, [orderId, vendorId, token]);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      fetchChat();

      // Subscribe to real-time events via Laravel Broadcasting
      const unsubscribe = realtimeService.subscribeToOrderChat(orderId, vendorId, token, {
        onMessage: (newMsg) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        },
        onConfirmationUpdate: (data) => {
          setConversation((prev) =>
            prev ? { ...prev, confirmation_status: data.confirmation_status } : null,
          );
          onStatusUpdated?.(data.confirmation_status);
        },
        onPollRefresh: async () => {
          await fetchChat();
        },
      });

      return () => {
        unsubscribe();
      };
    }
  }, [visible, orderId, vendorId, token, fetchChat, onStatusUpdated]);

  const handleSend = async (customText?: string) => {
    const textToSend = customText ?? inputText;
    if (!textToSend.trim() || sending) return;

    setSending(true);
    try {
      const newMsg = await sendChatMessage(orderId, vendorId, textToSend.trim(), token);
      setMessages((prev) => [...prev, newMsg]);
      setInputText('');
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to send message.';
      Alert.alert('Error', msg);
    } finally {
      setSending(false);
    }
  };

  const handleRequestConfirmation = async () => {
    setActionLoading(true);
    try {
      const msg = await requestOrderConfirmation(orderId, vendorId, token);
      setMessages((prev) => [...prev, msg]);
      setConversation((prev) => (prev ? { ...prev, confirmation_status: 'pending_confirmation' } : null));
      onStatusUpdated?.('pending_confirmation');
      Alert.alert('Request Sent', 'Customer has been notified to confirm this order.');
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to request confirmation.';
      Alert.alert('Error', msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmOrder = async () => {
    Alert.alert(
      'Confirm Order',
      'Are you sure you want to confirm this order? The vendor will now start butchering and preparing your items.',
      [
        { text: 'Wait, not yet', style: 'cancel' },
        {
          text: 'Yes, Confirm',
          style: 'default',
          onPress: async () => {
            setActionLoading(true);
            try {
              const res = await confirmOrderChat(orderId, vendorId, token);
              setMessages((prev) => [...prev, res.message]);
              setConversation((prev) => (prev ? { ...prev, confirmation_status: 'confirmed' } : null));
              onStatusUpdated?.('confirmed');
              Alert.alert('Confirmed!', 'Your order has been confirmed. Vendor can now safely prepare it.');
              setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
            } catch (err) {
              const msg = err instanceof ApiError ? err.message : 'Failed to confirm order.';
              Alert.alert('Error', msg);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleCancelOrder = async () => {
    Alert.alert(
      'Cancel Order',
      'Do you want to cancel this order? Items will not be prepared and stock will be returned to the vendor.',
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Cancel Order',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const res = await cancelOrderChat(orderId, vendorId, token, 'Customer requested cancellation via chat');
              setMessages((prev) => [...prev, res.message]);
              setConversation((prev) => (prev ? { ...prev, confirmation_status: 'cancelled' } : null));
              onStatusUpdated?.('cancelled');
              Alert.alert('Cancelled', 'Order was cancelled and items were not prepared.');
              setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
            } catch (err) {
              const msg = err instanceof ApiError ? err.message : 'Failed to cancel order.';
              Alert.alert('Error', msg);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const confirmationStatus: ConfirmationStatus =
    conversation?.confirmation_status ?? (isCod ? 'pending_confirmation' : 'none');

  const displayOrderNum = conversation?.order?.order_number ?? orderNumber ?? `ORD-${orderId}`;
  const displayStall = conversation?.vendor?.stall_name ?? stallName ?? 'Vendor Stall';

  return (
    <Modal visible={visible} animationType="slide" transparent={isDesktop} onRequestClose={onClose}>
      <View style={[styles.backdrop, isDesktop && styles.desktopBackdrop]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[
            styles.container,
            isDesktop && {
              width: Math.min(windowWidth * 0.9, 640),
              height: Math.min(windowHeight * 0.85, 750),
              borderRadius: 16,
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 20,
              elevation: 8,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarWrap}>
                <Ionicons name="storefront" size={20} color="#059669" />
              </View>
              <View style={styles.headerTextWrap}>
                <View style={styles.headerTitleRow}>
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    {displayStall}
                  </Text>
                  {isCod && (
                    <View style={styles.codBadge}>
                      <Text style={styles.codBadgeText}>COD</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.headerSubtitle}>
                  Order #{displayOrderNum} · {conversation?.vendor?.stall_location ?? 'Market Stall'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close chat"
            >
              <Ionicons name="close" size={22} color="#4B5563" />
            </TouchableOpacity>
          </View>

          {/* COD Confirmation Alert Banner */}
          {confirmationStatus === 'pending_confirmation' && (
            <View style={styles.alertBanner}>
              <View style={styles.alertIconWrap}>
                <Ionicons name="alert-circle" size={20} color="#D97706" />
              </View>
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>Awaiting Order Confirmation</Text>
                <Text style={styles.alertDesc}>
                  {userRole === 'customer'
                    ? 'Vendors only prepare fresh perishable goods once you confirm you will claim this COD order.'
                    : 'Customer must confirm this order before you butcher or prepare perishable items.'}
                </Text>

                {userRole === 'customer' && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.confirmBtn, actionLoading && styles.btnDisabled]}
                      onPress={handleConfirmOrder}
                      disabled={actionLoading}
                    >
                      <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                      <Text style={styles.confirmBtnText}>Confirm Order</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.cancelBtn, actionLoading && styles.btnDisabled]}
                      onPress={handleCancelOrder}
                      disabled={actionLoading}
                    >
                      <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {userRole === 'vendor' && (
                  <TouchableOpacity
                    style={[styles.nudgeBtn, actionLoading && styles.btnDisabled]}
                    onPress={handleRequestConfirmation}
                    disabled={actionLoading}
                  >
                    <Ionicons name="notifications-outline" size={14} color="#D97706" />
                    <Text style={styles.nudgeBtnText}>Re-send Confirmation Request</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {confirmationStatus === 'confirmed' && (
            <View style={[styles.alertBanner, styles.confirmedBanner]}>
              <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
              <View style={styles.alertContent}>
                <Text style={[styles.alertTitle, { color: '#166534' }]}>Order Confirmed</Text>
                <Text style={[styles.alertDesc, { color: '#15803D' }]}>
                  {userRole === 'customer'
                    ? 'You confirmed this order. The vendor is now preparing your items!'
                    : 'Customer confirmed! You can now safely prepare and pack the items.'}
                </Text>
              </View>
            </View>
          )}

          {confirmationStatus === 'cancelled' && (
            <View style={[styles.alertBanner, styles.cancelledBanner]}>
              <Ionicons name="close-circle" size={20} color="#DC2626" />
              <View style={styles.alertContent}>
                <Text style={[styles.alertTitle, { color: '#991B1B' }]}>Order Cancelled</Text>
                <Text style={[styles.alertDesc, { color: '#B91C1C' }]}>
                  This order was cancelled. Items were not prepared and stock was returned.
                </Text>
              </View>
            </View>
          )}

          {/* Messages List */}
          {loading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color="#059669" />
              <Text style={styles.loadingText}>Loading conversation history...</Text>
            </View>
          ) : (
            <ScrollView
              ref={scrollViewRef}
              style={styles.messageList}
              contentContainerStyle={styles.messageContent}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              {/* Dispute & History Notice */}
              <View style={styles.noticeCard}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#6B7280" />
                <Text style={styles.noticeText}>
                  Chat history is retained for customer satisfaction and dispute resolution reference.
                </Text>
              </View>

              {messages.length === 0 ? (
                <View style={styles.emptyMessages}>
                  <Ionicons name="chatbubbles-outline" size={38} color="#D1D5DB" />
                  <Text style={styles.emptyTitle}>No messages yet</Text>
                  <Text style={styles.emptySubtitle}>
                    {userRole === 'customer'
                      ? 'Clarify cut, quantity, or pickup time directly with the vendor.'
                      : 'Message the customer to confirm or clarify order details.'}
                  </Text>
                </View>
              ) : (
                messages.map((msg) => {
                  const isMe =
                    userRole === 'customer'
                      ? msg.sender_type === 'customer'
                      : msg.sender_type === 'vendor';

                  const isSystem = msg.sender_type === 'system' || msg.message_type !== 'text' && msg.message_type !== 'clarification';

                  if (isSystem) {
                    return (
                      <View key={msg.id} style={styles.systemCardWrap}>
                        <View
                          style={[
                            styles.systemCard,
                            msg.message_type === 'order_confirmed' && styles.systemConfirmed,
                            msg.message_type === 'order_cancelled' && styles.systemCancelled,
                          ]}
                        >
                          <Ionicons
                            name={
                              msg.message_type === 'order_confirmed'
                                ? 'checkmark-circle'
                                : msg.message_type === 'order_cancelled'
                                ? 'close-circle'
                                : 'information-circle'
                            }
                            size={16}
                            color={
                              msg.message_type === 'order_confirmed'
                                ? '#16A34A'
                                : msg.message_type === 'order_cancelled'
                                ? '#DC2626'
                                : '#D97706'
                            }
                          />
                          <Text style={styles.systemMessageText}>{msg.message}</Text>
                        </View>
                      </View>
                    );
                  }

                  return (
                    <View
                      key={msg.id}
                      style={[
                        styles.bubbleWrap,
                        isMe ? styles.bubbleWrapRight : styles.bubbleWrapLeft,
                      ]}
                    >
                      {!isMe && (
                        <Text style={styles.senderLabel}>
                          {msg.sender_name ?? (msg.sender_type === 'vendor' ? 'Vendor' : 'Customer')}
                        </Text>
                      )}
                      <View
                        style={[
                          styles.bubble,
                          isMe ? styles.bubbleMe : styles.bubbleThem,
                        ]}
                      >
                        <Text style={[styles.bubbleText, isMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
                          {msg.message}
                        </Text>
                        <Text style={[styles.timeText, isMe ? styles.timeTextMe : styles.timeTextThem]}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* Quick Clarification Chips */}
          <View style={styles.chipsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
              {(userRole === 'customer' ? CUSTOMER_QUICK_CLARIFICATIONS : VENDOR_QUICK_CLARIFICATIONS).map((text, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.chip}
                  onPress={() => handleSend(text)}
                  disabled={sending}
                >
                  <Text style={styles.chipText}>{text}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Input Bar */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              placeholder={
                userRole === 'customer'
                  ? 'Ask vendor about item cuts, pickup time...'
                  : 'Reply to customer...'
              }
              placeholderTextColor="#9CA3AF"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
            />

            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!inputText.trim() || sending) && styles.sendBtnDisabled,
              ]}
              onPress={() => handleSend()}
              disabled={!inputText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  desktopBackdrop: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  codBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#92400E',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    marginLeft: 8,
  },
  alertBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'flex-start',
    gap: 10,
  },
  confirmedBanner: {
    backgroundColor: '#ECFDF5',
    borderBottomColor: '#A7F3D0',
  },
  cancelledBanner: {
    backgroundColor: '#FEF2F2',
    borderBottomColor: '#FECACA',
  },
  alertIconWrap: {
    marginTop: 2,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  alertDesc: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#DC2626',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelBtnText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
  nudgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
  },
  nudgeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
  },
  messageList: {
    flex: 1,
  },
  messageContent: {
    padding: 14,
    gap: 12,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    flex: 1,
  },
  emptyMessages: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4B5563',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    maxWidth: 260,
  },
  systemCardWrap: {
    alignItems: 'center',
    marginVertical: 4,
  },
  systemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    maxWidth: '90%',
  },
  systemConfirmed: {
    backgroundColor: '#DCFCE7',
  },
  systemCancelled: {
    backgroundColor: '#FEE2E2',
  },
  systemMessageText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    flexShrink: 1,
  },
  bubbleWrap: {
    maxWidth: '80%',
    marginBottom: 4,
  },
  bubbleWrapRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubbleWrapLeft: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 2,
    marginLeft: 4,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleMe: {
    backgroundColor: '#059669',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextMe: {
    color: '#FFFFFF',
  },
  bubbleTextThem: {
    color: '#1F2937',
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  timeTextMe: {
    color: '#D1FAE5',
  },
  timeTextThem: {
    color: '#9CA3AF',
  },
  chipsContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingVertical: 6,
  },
  chipsContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  chip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipText: {
    fontSize: 12,
    color: '#374151',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 14,
    color: '#111827',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
});
