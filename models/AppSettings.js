import mongoose from "mongoose";
const appSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Mixed, required: true },
  description: { type: String },
  category: {
    type: String,
    enum: ['general', 'subscription', 'gamification', 'ai', 'limits', 'features'],
    default: 'general'
  },
  dataType: {
    type: String,
    enum: ['string', 'number', 'boolean', 'object', 'array'],
    default: 'string'
  },
  isPublic: { type: Boolean, default: false }, // Can users see this?
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
});

appSettingsSchema.index({ key: 1 });
appSettingsSchema.index({ category: 1 });

export default mongoose.model("AppSettings", appSettingsSchema);