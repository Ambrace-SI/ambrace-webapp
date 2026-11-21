/**
 * Marks a form that is changing a setting. The Settings window looks for it
 * when Escape is pressed: inside such a form Escape cancels the change, and
 * only elsewhere does it close the window.
 */
export const EDIT_FORM_ATTRIBUTE = "data-edit-form";
