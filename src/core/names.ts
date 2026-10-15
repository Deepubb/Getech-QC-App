/**
 * Makes a name safe as a file or folder name while changing as little as possible:
 * removes characters Windows, macOS and Android refuse (\ / : * ? " < > | and control
 * characters), collapses spaces, trims spaces and dots at the ends, drops a typed ".jpg".
 * "Belt tension (left)" stays "Belt tension (left)".
 */
export function safeName(input: string | null | undefined): string {
  return String(input ?? '')
    .replace(/\.(jpe?g|png|heic)\s*$/i, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 120);
}
