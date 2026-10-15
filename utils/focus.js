// Focus mode: while the product serves one exam family (HSSC), every student
// list is limited to that top-level category and its sub-categories, and the
// clients hide category pickers. Turning focus off brings everything back.
//
// Source of truth: AppSettings key "focusCategory" (a top-level category name
// or id; "" / null = off). Without that setting, DEFAULT_FOCUS applies.
//   node scripts/setFocus.js HSSC   |   node scripts/setFocus.js off
import AppSettings from '../models/AppSettings.js';
import Category from '../models/Category.js';
import Exam from '../models/Exam.js';

export const FOCUS_SETTING_KEY = 'focusCategory';
const DEFAULT_FOCUS = 'HSSC';
const CACHE_MS = 60 * 1000;

let cache = { at: 0, value: undefined };

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const resolve = async () => {
  const setting = await AppSettings.findOne({ key: FOCUS_SETTING_KEY }).lean();
  const raw = setting ? setting.value : DEFAULT_FOCUS;
  if (!raw || typeof raw !== 'string' || !raw.trim()) return null;

  const ref = raw.trim();
  const byId = /^[0-9a-f]{24}$/i.test(ref);
  const category = await Category.findOne(
    byId ? { _id: ref } : { name: new RegExp(`^${escapeRegex(ref)}$`, 'i'), parentCategory: null }
  )
    .select('name logo')
    .lean();
  if (!category) return null;

  const subCategories = await Category.find({ parentCategory: category._id, isActive: { $ne: false } })
    .select('name logo order')
    .sort({ order: 1, name: 1 })
    .lean();

  // live exams per sub-exam: clients show the sub-exam filter only when 2+ have exams
  const counts = await Exam.aggregate([
    { $match: { subCategory: { $in: subCategories.map((c) => c._id) }, status: { $in: ['scheduled', 'active'] } } },
    { $group: { _id: '$subCategory', n: { $sum: 1 } } },
  ]);
  const examCount = new Map(counts.map((c) => [String(c._id), c.n]));

  return {
    id: category._id,
    name: category.name,
    logo: category.logo || null,
    subCategories: subCategories.map(({ _id, name, logo }) => ({
      _id,
      name,
      logo: logo || null,
      examCount: examCount.get(String(_id)) || 0,
    })),
    // every category id that belongs to the focus (top-level + sub-categories)
    ids: [category._id, ...subCategories.map((c) => c._id)],
  };
};

/** The current focus ({ id, name, subCategories, ids }) or null when off. Cached for a minute. */
export const getFocus = async () => {
  if (cache.value !== undefined && Date.now() - cache.at < CACHE_MS) return cache.value;
  try {
    cache = { at: Date.now(), value: await resolve() };
  } catch (err) {
    console.error('Focus lookup failed:', err.message);
    if (cache.value === undefined) return null;
  }
  return cache.value;
};

export const clearFocusCache = () => {
  cache = { at: 0, value: undefined };
};

/** Mongo filter on `field` limiting to the focus categories ({} when focus is off). */
export const focusFilter = (focus, field = 'category') => (focus ? { [field]: { $in: focus.ids } } : {});

/** Public shape for clients (no internal id list). */
export const publicFocus = (focus) =>
  focus ? { id: focus.id, name: focus.name, logo: focus.logo, subCategories: focus.subCategories } : null;
