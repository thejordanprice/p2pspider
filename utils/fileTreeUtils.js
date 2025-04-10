/**
 * File Tree Utilities
 * Server-side utilities for processing file path data
 */

/**
 * Build a file tree structure from an array of file paths
 * @param {Array|String} filePaths - Array of file paths/objects or comma-separated string
 * @return {Object} Structured file tree object
 */
function buildFileTree(filePaths) {
  const fileTree = {};
  
  // Convert string to array if needed
  if (typeof filePaths === 'string') {
    // First check if we should convert commas to slashes
    if (filePaths.includes(',') && !filePaths.includes('/')) {
      filePaths = filePaths.replace(/,/g, '/');
    }
    
    // Then split by separator
    filePaths = filePaths.includes('/') 
      ? filePaths.split(/[\/\\]/).map(f => f.trim()).filter(f => f)
      : filePaths.split(',').map(f => f.trim()).filter(f => f);
  }
  
  if (Array.isArray(filePaths)) {
    filePaths.forEach(filePathItem => {
      // Handle both string paths and {path, size} objects
      let filePath, fileSize = 0;
      
      if (typeof filePathItem === 'object' && filePathItem !== null) {
        filePath = filePathItem.path || '';
        fileSize = filePathItem.size || 0;
      } else {
        filePath = filePathItem;
      }
      
      // Pre-process the path - convert commas to slashes if there are no slashes
      if (filePath.includes(',') && !filePath.includes('/')) {
        filePath = filePath.replace(/,/g, '/');
      }
      
      // Check if we have comma-separated paths instead of slashes
      const hasCommas = filePath.includes(',');
      const hasPaths = filePath.includes('/');
      
      // Determine the separator to use (prefer slashes if both exist)
      const separator = hasPaths ? '/' : (hasCommas ? ',' : '/');
      
      // Split the file path into directories
      const parts = filePath.split(separator);
      let currentLevel = fileTree;
      
      // For each part of the path, create nested objects
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        if (part === '') continue;
        
        // If this is the last part (file), store as a file
        if (i === parts.length - 1) {
          if (!currentLevel.files) currentLevel.files = [];
          currentLevel.files.push({
            name: part,
            size: fileSize
          });
        } else {
          // Otherwise it's a directory
          if (!currentLevel.dirs) currentLevel.dirs = {};
          if (!currentLevel.dirs[part]) currentLevel.dirs[part] = {};
          currentLevel = currentLevel.dirs[part];
        }
      }
    });
  }
  
  return fileTree;
}

/**
 * Get appropriate file icon and color based on file extension
 * @param {String} fileName - Name of the file
 * @return {Object} Object with fileIcon and iconColor properties
 */
function getFileIconInfo(fileName) {
  let fileIcon = 'fa-file';
  let iconColor = 'text-gray-500';
  
  const fileExt = fileName.split('.').pop().toLowerCase();
  
  // Video files
  if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(fileExt)) {
    fileIcon = 'fa-file-video';
    iconColor = 'text-red-500';
  } 
  // Audio files
  else if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(fileExt)) {
    fileIcon = 'fa-file-audio';
    iconColor = 'text-blue-500';
  } 
  // Image files
  else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(fileExt)) {
    fileIcon = 'fa-file-image';
    iconColor = 'text-green-500';
  } 
  // Archive files
  else if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(fileExt)) {
    fileIcon = 'fa-file-archive';
    iconColor = 'text-yellow-500';
  }
  // PDF files
  else if (fileExt === 'pdf') {
    fileIcon = 'fa-file-pdf';
    iconColor = 'text-red-600';
  }
  // Document files
  else if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(fileExt)) {
    fileIcon = 'fa-file-alt';
    iconColor = 'text-blue-600';
  }
  // Code or text files
  else if (['js', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'php', 'html', 'css', 'xml', 'json', 'md', 'csv', 'log'].includes(fileExt)) {
    fileIcon = 'fa-file-code';
    iconColor = 'text-purple-600';
  }
  // Executable files
  else if (['exe', 'dll', 'bat', 'sh', 'app', 'dmg', 'deb', 'rpm'].includes(fileExt)) {
    fileIcon = 'fa-cog';
    iconColor = 'text-gray-600';
  }
  
  return { fileIcon, iconColor };
}

/**
 * Format file size in human-readable format
 * @param {Number} size - File size in bytes
 * @return {String} Formatted size
 */
function formatFileSize(size) {
  if (size === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(size) / Math.log(1024));
  return (size / Math.pow(1024, i)).toFixed(i > 0 ? 2 : 0) + ' ' + units[i];
}

/**
 * Render file tree as HTML
 * @param {Object} node - File tree node
 * @param {String} path - Current path
 * @param {Number} level - Current indent level
 * @return {String} HTML markup
 */
function renderFileTree(node, path = '', level = 0) {
  let html = '';
  const indent = level * 1.5;
  
  // Render directories first
  if (node.dirs) {
    Object.keys(node.dirs).sort().forEach(dir => {
      const dirPath = path ? `${path}/${dir}` : dir;
      html += '<div class="flex items-start py-1 directory" style="padding-left: ' + indent + 'rem; --indent-level: ' + indent + ';">' +
        '<div class="flex-shrink-0 text-dark-700 mr-2">' +
          '<i class="fas fa-folder text-primary-500"></i>' +
        '</div>' +
        '<div class="font-medium text-dark-700">' + dir + '/</div>' +
      '</div>';
      html += renderFileTree(node.dirs[dir], dirPath, level + 1);
    });
  }
  
  // Then render files
  if (node.files) {
    // Sort files by name
    node.files.sort((a, b) => {
      const nameA = typeof a === 'object' ? a.name : a;
      const nameB = typeof b === 'object' ? b.name : b;
      return nameA.localeCompare(nameB);
    }).forEach(file => {
      // Handle both string files and {name, size} objects
      let fileName, fileSize = 0;
      
      if (typeof file === 'object' && file !== null) {
        fileName = file.name || '';
        fileSize = file.size || 0;
      } else {
        fileName = file;
      }
      
      const { fileIcon, iconColor } = getFileIconInfo(fileName);
      const formattedSize = formatFileSize(fileSize);
      
      html += '<div class="flex items-start py-1" style="padding-left: ' + indent + 'rem; --indent-level: ' + indent + ';">' +
        '<div class="flex-shrink-0 mr-2 ' + iconColor + '">' +
          '<i class="fas ' + fileIcon + '"></i>' +
        '</div>' +
        '<div class="flex-grow text-dark-600">' + fileName + '</div>' +
        '<div class="text-dark-400 text-xs ml-2">' + formattedSize + '</div>' +
      '</div>';
    });
  }
  
  return html;
}

module.exports = {
  buildFileTree,
  getFileIconInfo,
  renderFileTree,
  formatFileSize
}; 