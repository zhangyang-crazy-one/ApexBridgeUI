// Attachment data model
export type FileType = 'image' | 'document' | 'pdf' | 'audio' | 'video' | 'other';

export interface Attachment {
  id: string;                        // 唯一标识符 (UUID)
  filename: string;                  // 原始文件名
  file_type: FileType;               // 检测到的文件类型
  file_size: number;                 // 大小(字节)
  file_path_or_base64: string;       // 本地路径或 base64 数据 URL
  thumbnail?: string;                // 缩略图路径 (用于图像)
}

/**
 * Detect file type from filename extension
 */
export function detectFileType(filename: string): FileType {
  const ext = filename.split('.').pop()?.toLowerCase();
  const typeMap: Record<string, FileType> = {
    'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'webp': 'image',
    'doc': 'document', 'docx': 'document', 'txt': 'document', 'md': 'document',
    'pdf': 'pdf',
    'mp3': 'audio', 'wav': 'audio', 'flac': 'audio', 'ogg': 'audio',
    'mp4': 'video', 'webm': 'video', 'avi': 'video', 'mov': 'video'
  };
  return typeMap[ext || ''] || 'other';
}

/**
 * Validate Attachment data
 */
export function validateAttachment(attachment: Attachment): string | null {
  if (!attachment.id || attachment.id.length === 0) {
    return 'Attachment ID is required';
  }
  if (!attachment.filename || attachment.filename.length === 0) {
    return 'Attachment filename is required';
  }
  const validTypes: FileType[] = ['image', 'document', 'pdf', 'audio', 'video', 'other'];
  if (!validTypes.includes(attachment.file_type)) {
    return 'Attachment file_type must be one of: image, document, pdf, audio, video, other';
  }
  if (attachment.file_size <= 0) {
    return 'Attachment file_size must be greater than 0';
  }
  if (attachment.file_size > 10485760) { // 10MB
    return 'Attachment file_size exceeds maximum 10MB';
  }
  if (!attachment.file_path_or_base64 || attachment.file_path_or_base64.length === 0) {
    return 'Attachment file_path_or_base64 is required';
  }
  return null;
}
