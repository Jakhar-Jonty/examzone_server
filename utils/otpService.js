// Mock OTP service - always accepts "123456" for MVP
export const sendOTP = async (phoneNumber) => {
  // In production, integrate with SMS service like Twilio, MSG91, etc.
  console.log(`OTP sent to ${phoneNumber}: 123456`);
  return { success: true, otp: '123456' };
};

export const verifyOTP = async (phoneNumber, otp) => {
  // Mock verification - always accept "123456"
  if (otp === '123456') {
    return { success: true };
  }
  return { success: false, message: 'Invalid OTP' };
};

