import StudyPlan from '../models/StudyPlan.js';

export const getPlans = async (req, res) => {
  try {
    const plans = await StudyPlan.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ plans });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getPlan = async (req, res) => {
  try {
    const plan = await StudyPlan.findOne({ _id: req.params.id, user: req.user._id });
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    res.json({ plan });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createPlan = async (req, res) => {
  try {
    const { title, description, startDate, endDate, targetExam, dailySchedule, subjects, milestones } = req.body;

    if (!title || !startDate || !endDate) {
      return res.status(400).json({ message: 'title, startDate and endDate are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) return res.status(400).json({ message: 'endDate must be after startDate' });

    const durationWeeks = Math.ceil((end - start) / (7 * 24 * 3600 * 1000));
    const totalTopics = (subjects || []).reduce((acc, s) => acc + (s.topics?.length || 0), 0);

    const plan = await StudyPlan.create({
      user: req.user._id,
      title,
      description,
      startDate: start,
      endDate: end,
      durationWeeks,
      targetExam,
      dailySchedule,
      subjects: subjects || [],
      milestones: milestones || [],
      progress: { totalTopics },
    });

    res.status(201).json({ plan });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updatePlan = async (req, res) => {
  try {
    const plan = await StudyPlan.findOne({ _id: req.params.id, user: req.user._id });
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    const allowed = ['title', 'description', 'endDate', 'dailySchedule', 'subjects', 'milestones', 'weeklyGoals', 'status'];
    allowed.forEach((k) => { if (req.body[k] !== undefined) plan[k] = req.body[k]; });
    plan.updatedAt = new Date();

    // Recompute progress.totalTopics if subjects changed.
    if (req.body.subjects) {
      plan.progress.totalTopics = plan.subjects.reduce((acc, s) => acc + (s.topics?.length || 0), 0);
      const completed = plan.subjects.reduce(
        (acc, s) => acc + (s.topics?.filter((t) => t.status === 'completed').length || 0),
        0
      );
      plan.progress.completedTopics = completed;
      plan.progress.overallProgress = plan.progress.totalTopics
        ? Math.round((completed / plan.progress.totalTopics) * 100)
        : 0;
    }

    if (plan.status === 'completed' && !plan.completedAt) plan.completedAt = new Date();

    await plan.save();
    res.json({ plan });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deletePlan = async (req, res) => {
  try {
    const plan = await StudyPlan.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    res.json({ message: 'Plan deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const completeMilestone = async (req, res) => {
  try {
    const plan = await StudyPlan.findOne({ _id: req.params.id, user: req.user._id });
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    const milestone = plan.milestones.id(req.params.milestoneId);
    if (!milestone) return res.status(404).json({ message: 'Milestone not found' });

    milestone.isCompleted = true;
    milestone.completedAt = new Date();
    await plan.save();
    res.json({ plan });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateTopicStatus = async (req, res) => {
  try {
    const { subjectIndex, topicIndex, status } = req.body;
    if (!['not-started', 'in-progress', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const plan = await StudyPlan.findOne({ _id: req.params.id, user: req.user._id });
    if (!plan) return res.status(404).json({ message: 'Plan not found' });

    const topic = plan.subjects?.[subjectIndex]?.topics?.[topicIndex];
    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    topic.status = status;

    // Recompute overall progress.
    const totalTopics = plan.subjects.reduce((acc, s) => acc + (s.topics?.length || 0), 0);
    const completed = plan.subjects.reduce(
      (acc, s) => acc + (s.topics?.filter((t) => t.status === 'completed').length || 0),
      0
    );
    plan.progress.totalTopics = totalTopics;
    plan.progress.completedTopics = completed;
    plan.progress.overallProgress = totalTopics ? Math.round((completed / totalTopics) * 100) : 0;

    await plan.save();
    res.json({ plan });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
