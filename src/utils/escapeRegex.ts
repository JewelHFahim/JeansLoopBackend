/**
 * Escapes special regex characters in a user-supplied string.
 * Must be used before inserting any user input into a MongoDB $regex query
 * to prevent Regular Expression Denial of Service (ReDoS) attacks.
 *
 * @example
 *   { name: { $regex: escapeRegex(req.query.keyword), $options: 'i' } }
 */
export function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
