import type { FeedbackKind, ProjectKind, ProjectStatus, RenewalTrack } from './types'
import { BLUE_LINE as STD_BLUE_LINE, LAND_USE as STD_LAND_USE, landUseColor } from './urban-standard/urban-standard.js'

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

/** Plan boundaries ("the blue line") are drawn in blue on every map, as on plan drawings. From the shared standard. */
export const BLUE_LINE = STD_BLUE_LINE

/**
 * Land-use colours, from the shared urban-twin standard (src/lib/urban-standard, copied from PLANS-GH).
 * The colours are the Mavat legend swatches read from the tashrits in public/plans (verified when the same
 * colour repeats across plans). A category without a verified colour is neutral and says "לבדיקה".
 */
export const LAND_USE: Record<string, { label: string; color: string; verified: string }> = Object.fromEntries(
  Object.entries(STD_LAND_USE).map(([k, v]) => [
    k,
    { label: v.verified === 'pending' ? `${v.label} (צבע לבדיקה)` : v.label, color: landUseColor(k), verified: v.verified },
  ]),
)
