/**
 * Directory Tree View
 * Handles the interactive file/folder tree view with expand/collapse functionality
 */

// Initialize the directory tree
function initDirectoryTree() {
  // Start with all folders open
  const folderIcons = document.querySelectorAll('.directory-tree .fa-folder');
  
  folderIcons.forEach(icon => {
    // Convert to open folder icon initially
    icon.classList.remove('fa-folder');
    icon.classList.add('fa-folder-open');
    
    const folderDiv = icon.closest('.flex.items-start');
    if (folderDiv) {
      // Add class for styling
      folderDiv.classList.add('folder-toggle');
      icon.classList.add('folder-icon');
      
      // Get all direct children until the next folder at the same level
      const allItems = Array.from(document.querySelectorAll('.directory-tree .flex.items-start'));
      const folderIndex = allItems.indexOf(folderDiv);
      const folderLevel = parseFloat(folderDiv.style.paddingLeft) || 0;
      
      // Find all descendant elements (with greater padding/indent)
      const childElements = [];
      let folderContents = document.createElement('div');
      folderContents.className = 'folder-contents';
      
      // Insert the container after the folder
      folderDiv.insertAdjacentElement('afterend', folderContents);
      
      for (let i = folderIndex + 1; i < allItems.length; i++) {
        const currentElement = allItems[i];
        const currentLevel = parseFloat(currentElement.style.paddingLeft) || 0;
        
        // If we've returned to the same or lower level, we're done with this folder's children
        if (currentLevel <= folderLevel) {
          break;
        }
        
        // Add class for animation
        currentElement.classList.add('directory-item');
        childElements.push(currentElement);
        
        // Move this element into the folder-contents div
        folderContents.appendChild(currentElement);
      }
      
      // Click handler to toggle visibility
      folderDiv.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent parent folder click events
        
        // Add a visual feedback animation
        folderDiv.classList.add('active');
        setTimeout(() => folderDiv.classList.remove('active'), 600);
        
        // Toggle between folder and folder-open icons
        const folderIcon = folderDiv.querySelector('.fa-folder, .fa-folder-open');
        const isClosing = folderIcon.classList.contains('fa-folder-open');
        
        // Toggle the container's collapsed state
        folderContents.classList.toggle('collapsed', isClosing);
        
        if (isClosing) {
          folderIcon.classList.remove('fa-folder-open');
          folderIcon.classList.add('fa-folder');
          
          // When closing, find and collapse all nested folders too
          const nestedFolderContainers = folderContents.querySelectorAll('.folder-contents:not(.collapsed)');
          const nestedFolderIcons = folderContents.querySelectorAll('.fa-folder-open');
          
          nestedFolderContainers.forEach(container => {
            container.classList.add('collapsed');
          });
          
          nestedFolderIcons.forEach(icon => {
            icon.classList.remove('fa-folder-open');
            icon.classList.add('fa-folder');
          });
        } else {
          folderIcon.classList.remove('fa-folder');
          folderIcon.classList.add('fa-folder-open');
        }
        
        // Update tree lines after toggling visibility
        setTimeout(updateTreeLines, 300);
      });
    }
  });
  
  // Initialize collapse/expand all buttons
  initCollapseExpandButtons();
  
  // Initial update of tree lines
  updateTreeLines();
}

// Initialize collapse/expand all buttons
function initCollapseExpandButtons() {
  const collapseAllBtn = document.getElementById('collapse-all');
  const expandAllBtn = document.getElementById('expand-all');
  
  if (collapseAllBtn) {
    collapseAllBtn.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Add visual feedback
      collapseAllBtn.classList.add('active-btn');
      setTimeout(() => collapseAllBtn.classList.remove('active-btn'), 300);
      
      const folderIcons = document.querySelectorAll('.directory-tree .folder-toggle .fa-folder-open');
      folderIcons.forEach(folderIcon => {
        const folderDiv = folderIcon.closest('.folder-toggle');
        if (folderDiv) {
          folderDiv.click();
        }
      });
    });
  }
  
  if (expandAllBtn) {
    expandAllBtn.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Add visual feedback
      expandAllBtn.classList.add('active-btn');
      setTimeout(() => expandAllBtn.classList.remove('active-btn'), 300);
      
      const folderIcons = document.querySelectorAll('.directory-tree .folder-toggle .fa-folder');
      folderIcons.forEach(folderIcon => {
        const folderDiv = folderIcon.closest('.folder-toggle');
        if (folderDiv) {
          folderDiv.click();
        }
      });
    });
  }
}

// Helper function to ensure tree line consistency
function updateTreeLines() {
  const allItems = document.querySelectorAll('.directory-tree .flex.items-start');
  allItems.forEach(item => {
    // If this item is the last visible child at its level, add a class
    const level = parseFloat(item.style.paddingLeft) || 0;
    const isCollapsed = item.classList.contains('collapsed');
    
    if (!isCollapsed) {
      // Find the next visible sibling at same level
      let nextSiblingAtSameLevel = null;
      let current = item.nextElementSibling;
      
      while (current) {
        const currentLevel = parseFloat(current.style.paddingLeft) || 0;
        const isCurrentCollapsed = current.classList.contains('collapsed');
        
        if (currentLevel < level) {
          // We've gone back up the tree, no more siblings
          break;
        } else if (currentLevel === level && !isCurrentCollapsed) {
          nextSiblingAtSameLevel = current;
          break;
        }
        
        current = current.nextElementSibling;
      }
      
      // If no visible siblings at same level, this is the last one
      item.classList.toggle('last-at-level', !nextSiblingAtSameLevel);
    }
  });
}

// Create a helper function to build file trees from path arrays
function buildFileTree(filePaths) {
  const fileTree = {};
  
  if (Array.isArray(filePaths)) {
    filePaths.forEach(filePath => {
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
          currentLevel.files.push(part);
        } else {
          // Otherwise it's a directory
          if (!currentLevel.dirs) currentLevel.dirs = {};
          if (!currentLevel.dirs[part]) currentLevel.dirs[part] = {};
          currentLevel = currentLevel.dirs[part];
        }
      }
    });
  } else if (typeof filePaths === 'string') {
    // Handle string representation
    const fileArray = filePaths.split(',').map(f => f.trim()).filter(f => f);
    return buildFileTree(fileArray);
  }
  
  return fileTree;
}

// Helper function to get appropriate file icon based on extension
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

// Recursive function to render the tree as HTML
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
    node.files.sort().forEach(file => {
      const { fileIcon, iconColor } = getFileIconInfo(file);
      
      html += '<div class="flex items-start py-1" style="padding-left: ' + indent + 'rem; --indent-level: ' + indent + ';">' +
        '<div class="flex-shrink-0 mr-2 ' + iconColor + '">' +
          '<i class="fas ' + fileIcon + '"></i>' +
        '</div>' +
        '<div class="text-dark-600">' + file + '</div>' +
      '</div>';
    });
  }
  
  return html;
}

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  const directoryTreeContainer = document.querySelector('.directory-tree');
  if (directoryTreeContainer) {
    initDirectoryTree();
    
    // Initialize buttons after the tree is set up
    setTimeout(() => {
      initCollapseExpandButtons();
    }, 100);
  }
}); 