// Fixed links in the top bar's "מערכת" menu.
export const DEV_CHAT_URL = 'https://claude.ai/code/session_01F5FGwTP12US6eWBc7JdpmK'
// Link to the Claude research project. Empty: the menu item stays hidden until Anat sends the link.
export const RESEARCH_URL = ''

// The sentence shown with the link preview (index.html description and og:description) and in the share sheet.
export const SHARE_TEXT =
  'מה נבנה סביבי: מפה של כל פרויקטי ההתחדשות העירונית באשדוד, עם מודל תלת-ממדי של הבניינים לפי התוכנית, בשפה פשוטה, ומקום לשאול ולהגיב.'

// The picture sent with the link (and og:image in index.html). Raise SHARE_VERSION when the picture or the
// sentence changes: WhatsApp keeps an old preview per address, and a new address makes it fetch again.
export const SHARE_VERSION = '2'
export const SHARE_IMAGE = `/og.png?v=${SHARE_VERSION}`
