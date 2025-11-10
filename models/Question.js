import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: [{
    optionText: { type: String, required: true },
    optionLabel: { type: String, enum: ['A', 'B', 'C', 'D'], required: true }
  }],
  correctAnswer: { 
    type: String, 
    enum: ['A', 'B', 'C', 'D'], 
    required: true 
  },
  explanation: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['SSC', 'Banking', 'HSSC'], 
    required: true 
  },
  subject: { type: String, required: true },
  topic: { type: String },
  marks: { type: Number, default: 1 },
  difficulty: { 
    type: String, 
    enum: ['Easy', 'Medium', 'Hard'], 
    default: 'Medium' 
  },
  language: {
    type: String,
    enum: ['Hindi', 'English', 'Both'],
    default: 'English'
  },
  questionTextHindi: { type: String },
  optionsHindi: [{
    optionText: { type: String },
    optionLabel: { type: String, enum: ['A', 'B', 'C', 'D'] }
  }],
  explanationHindi: { type: String },
  questionImage: { type: String },
  isAIGenerated: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Question', questionSchema);

