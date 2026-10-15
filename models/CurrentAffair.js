import mongoose from 'mongoose';

// One current-affairs item (usually one news story) for a given IST day.
// MCQs stay embedded here while the item is a draft; publishing copies them
// into the question bank (subject "Haryana GK", topic "Current Affairs") and
// links each one back through `question`.
const mcqSchema = new mongoose.Schema({
  questionText: { type: String, default: '' },
  questionTextHindi: { type: String, default: '' },
  options: [{ type: String }], // 4 options, A–D
  optionsHindi: [{ type: String }],
  correctIndex: { type: Number, min: 0, max: 3, default: 0 },
  explanation: { type: String, default: '' },
  explanationHindi: { type: String, default: '' },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
  question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' }, // set once published
});

const currentAffairSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, index: true }, // IST day, "YYYY-MM-DD"
    region: { type: String, enum: ['Haryana', 'National'], default: 'Haryana' },
    title: { type: String, default: '' },
    titleHindi: { type: String, default: '' },
    summary: { type: String, default: '' },
    summaryHindi: { type: String, default: '' },
    keyPoints: [{ text: String, textHindi: String }],
    tags: [{ type: String }],
    sourceText: { type: String, default: '' }, // pasted news, admin only
    sourceUrl: { type: String, default: '' },
    questions: [mcqSchema],
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    aiGenerated: { type: Boolean, default: false },
    publishedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

currentAffairSchema.index({ status: 1, date: -1, createdAt: -1 });

export default mongoose.model('CurrentAffair', currentAffairSchema);
