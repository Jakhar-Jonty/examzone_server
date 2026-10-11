import mongoose from 'mongoose';

const otpTokenSchema = new mongoose.Schema(
  {
    destination: {
      type: String,
      required: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    channel: {
      type: String,
      enum: ['sms', 'email'],
      required: true,
    },
    codeHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

otpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('OtpToken', otpTokenSchema);
