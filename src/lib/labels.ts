import type { FeedbackKind, ProjectKind, ProjectStatus, RenewalTrack } from './types'

export const KIND_LABEL: Record<ProjectKind, string> = {
  urban_renewal: 'התחדשות עירונית',
  new_construction: 'בנייה חדשה',
  public_building: 'מבנה ציבור',
  public_space: 'מרחב ציבורי',
  infrastructure: 'תשתיות',
}

export const TRACK_LABEL: Record<RenewalTrack, string> = {
  pinui_binui: 'פינוי-בינוי',
  tama38: 'תמ"א 38',
  other: 'מסלול אחר',
}

export const STATUS_ORDER: ProjectStatus[] = ['planning', 'approved', 'permit', 'construction', 'completed']

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: 'בתכנון',
  approved: 'תוכנית מאושרת',
  permit: 'היתר בנייה',
  construction: 'בביצוע',
  completed: 'הושלם',
}

/** What the current stage means for a resident, in plain words. */
export const STATUS_MEANING: Record<ProjectStatus, string> = {
  planning:
    'התוכנית עדיין נבחנת בוועדות התכנון. זה השלב שבו שאלות והערות של תושבים משפיעות הכי הרבה.',
  approved:
    'התוכנית אושרה. מכאן והלאה מתגבשים פרטי הביצוע: עיצוב הבניינים, השטחים הציבוריים ושלבי העבודה.',
  permit: 'ניתן היתר בנייה. העבודות צפויות להתחיל בקרוב, ויפורסמו הסדרי תנועה ובטיחות.',
  construction:
    'העבודות בעיצומן. לשאלות על רעש, תנועה או בטיחות באתר אפשר לכתוב כאן או לפנות למוקד העירוני 106.',
  completed: 'הפרויקט הושלם ונמסר לשימוש.',
}

export const STATUS_COLOR: Record<ProjectStatus, string> = {
  planning: '#B5B5B3',
  approved: '#8E8E8C',
  permit: '#626260',
  construction: '#2E2E2C',
  completed: '#000000',
}

export const FEEDBACK_LABEL: Record<FeedbackKind, string> = {
  question: 'שאלה',
  support: 'תמיכה',
  concern: 'חשש',
  idea: 'רעיון',
}

export const FEEDBACK_PROMPT: Record<FeedbackKind, string> = {
  question: 'מה תרצו לדעת על הפרויקט?',
  support: 'מה אתם אוהבים בפרויקט?',
  concern: 'מה מדאיג אתכם? כמה שיותר ספציפי, כך נוכל לבדוק טוב יותר.',
  idea: 'איזה רעיון יכול לשפר את הפרויקט או את המרחב סביבו?',
}

/** Plan boundaries ("the blue line") are drawn in blue on every map, as on plan drawings. */
export const BLUE_LINE = '#1D4ED8'

/** Land-use colours in the 3D model, close to the planning-portal palette. The key is massing/parcels `cat`. */
export const LAND_USE: Record<string, { label: string; color: string }> = {
  residential: { label: 'מגורים', color: '#E2AE48' },
  mixed: { label: 'מגורים ומסחר', color: '#D4834A' },
  commerce: { label: 'מסחר', color: '#B85C98' },
  employment: { label: 'תעסוקה', color: '#7A63B4' },
  public: { label: 'מבני ציבור', color: '#9A6A4C' },
  open: { label: 'שטח פתוח', color: '#6EA65F' },
  road: { label: 'דרכים, שבילים וחניה', color: '#A8A8A6' },
}
