/**
 * Directory Tree View
 * Handles the interactive file/folder tree view with expand/collapse functionality
 */

// Check if script has already been initialized to prevent duplication
if (window.directoryTreeInitialized) {
  console.log("Directory tree script already loaded");
} else {
  window.directoryTreeInitialized = true;

  // Wrap everything in an IIFE to avoid global scope pollution
  (function() {
    // Track initialization state to prevent duplicate initialization
    let isInitialized = false;
    let initAttempts = 0;
    const MAX_INIT_ATTEMPTS = 20; // Maximum number of retry attempts
    let initRetryTimeout = null;
    
    // Global helper to force close any folder that might have gotten stuck open
    function ensureProperFolderState() {
      // Find any open folders with collapsed state that shouldn't be visible
      const invalidFolders = document.querySelectorAll('.folder-contents.collapsed:not([style*="display: none"])');
      if (invalidFolders.length > 0) {
        invalidFolders.forEach(folder => {
          // Fix display style
          folder.style.display = 'none';
          folder.style.visibility = 'hidden';
          folder.style.height = '0';
          folder.style.position = 'absolute';
          folder.style.zIndex = '-1';
          
          // Also fix the icon if possible
          const prevElement = folder.previousElementSibling;
          if (prevElement && prevElement.classList.contains('folder-toggle')) {
            const icon = prevElement.querySelector('.fa-folder-open');
            if (icon) {
              icon.classList.remove('fa-folder-open');
              icon.classList.add('fa-folder');
            }
          }
        });
      }
      
      // Find any folders with open icon but collapsed contents
      const mismatchedIcons = document.querySelectorAll('.folder-toggle .fa-folder-open');
      mismatchedIcons.forEach(icon => {
        const folderToggle = icon.closest('.folder-toggle');
        if (folderToggle) {
          const nextElement = folderToggle.nextElementSibling;
          if (nextElement && 
              nextElement.classList.contains('folder-contents') && 
              nextElement.classList.contains('collapsed')) {
            // Fix the icon to match the collapsed state
            icon.classList.remove('fa-folder-open');
            icon.classList.add('fa-folder');
          }
        }
      });
      
      // Find any closed folders with non-collapsed contents
      const closedWithOpenContent = document.querySelectorAll('.folder-toggle .fa-folder');
      closedWithOpenContent.forEach(icon => {
        const folderToggle = icon.closest('.folder-toggle');
        if (folderToggle) {
          const nextElement = folderToggle.nextElementSibling;
          if (nextElement && 
              nextElement.classList.contains('folder-contents') && 
              !nextElement.classList.contains('collapsed') &&
              nextElement.style.display !== 'none') {
            // Open the folder properly
            ensureFolderOpen(folderToggle, nextElement, icon);
          }
        }
      });
      
      // Schedule the next check
      setTimeout(ensureProperFolderState, 2000);
    }
    
    // Helper function to ensure a folder is fully open
    function ensureFolderOpen(folderToggle, folderContents, folderIcon) {
      if (!folderToggle || !folderContents || !folderIcon) return;
      
      // Update icon
      folderIcon.classList.remove('fa-folder');
      folderIcon.classList.add('fa-folder-open');
      
      // Ensure full visibility
      folderContents.classList.remove('collapsed');
      folderContents.style.display = 'block';
      folderContents.style.visibility = 'visible';
      folderContents.style.height = 'auto';
      folderContents.style.position = 'relative';
      folderContents.style.zIndex = 'auto';
      folderContents.style.opacity = '1';
      folderContents.style.maxHeight = 'none';
      
      // Reset any processing state
      folderToggle.dataset.processing = 'false';
    }
    
    // Start the background folder state checker
    setTimeout(ensureProperFolderState, 1000);
    
    // Main initialization function with retry capability
    function initializeDirectoryTrees(forceReinit = false) {
      try {
        const containers = document.querySelectorAll('.directory-tree');
        
        if (containers.length === 0) {
          initAttempts++;
          if (initAttempts > MAX_INIT_ATTEMPTS) {
            console.log(`Maximum directory tree initialization attempts reached.`);
            return;
          }
          
          // Retry after a delay if no containers found
          clearTimeout(initRetryTimeout);
          initRetryTimeout = setTimeout(() => initializeDirectoryTrees(), 300);
          return;
        }
        
        // Check if any containers need initialization
        let containersInitialized = 0;
        let containersSkipped = 0;
        
        // Initialize each directory tree container
        containers.forEach((container, index) => {
          // Skip if this container has already been initialized and we're not forcing reinit
          if (container.dataset.initialized === 'true' && !forceReinit) {
            containersSkipped++;
            return;
          }
          
          // Check if container has content
          if (container.innerHTML.trim() === '') {
            return;
          }
          
          // Mark as initialized
          container.dataset.initialized = 'true';
          
          // Initialize the folder structure
          initDirectoryTree(container);
          containersInitialized++;
        });
        
        // If we found containers but couldn't initialize any, try once more with force=true
        if (containersInitialized === 0 && containersSkipped > 0 && !forceReinit) {
          setTimeout(() => initializeDirectoryTrees(true), 500);
          return;
        }
        
        // Mark global initialization as complete
        isInitialized = true;
      } catch (err) {
        console.error("Error initializing directory trees:", err);
      }
    }

    // Initialize the directory tree for a specific container
    function initDirectoryTree(container) {
      // Start with all folders open
      const folderIcons = container.querySelectorAll('.fa-folder');
      
      if (folderIcons.length === 0) {
        // If container is empty but has infohash data, try to retry later
        if (container.innerHTML.trim() === '' && container.dataset.infohash) {
          // Reset initialization flag to try again
          container.dataset.initialized = 'false';
          
          // Try again after a delay
          setTimeout(() => {
            if (container.innerHTML.trim() !== '') {
              initDirectoryTree(container);
            }
          }, 500);
        }
        
        return;
      }
      
      folderIcons.forEach(icon => {
        try {
          // Convert to open folder icon initially
          icon.classList.remove('fa-folder');
          icon.classList.add('fa-folder-open');
          
          const folderDiv = icon.closest('.flex.items-start');
          if (!folderDiv) {
            return;
          }
          
          // Add class for styling
          folderDiv.classList.add('folder-toggle');
          icon.classList.add('folder-icon');
          
          // Get all direct children until the next folder at the same level
          // Limit the scope to the current directory tree container
          const allItems = Array.from(container.querySelectorAll('.flex.items-start'));
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
            e.preventDefault(); // Prevent any default behavior
            
            // Get a reference to the folder contents and icon
            const folderIcon = folderDiv.querySelector('.fa-folder, .fa-folder-open');
            const folderContents = folderDiv.nextElementSibling;
            
            // Safety check - if no icon or contents found, exit
            if (!folderIcon || !folderContents || !folderContents.classList.contains('folder-contents')) {
              return;
            }
            
            // Determine if we're closing or opening
            const isClosing = folderIcon.classList.contains('fa-folder-open');
            
            // Prevent multiple rapid clicks
            if (folderDiv.dataset.processing === 'true') {
              return;
            }
            folderDiv.dataset.processing = 'true';
            
            // Add visual feedback animation
            folderDiv.classList.add('active');
            
            // When closing a folder
            if (isClosing) {
              // 1. First update the icon
              folderIcon.classList.remove('fa-folder-open');
              folderIcon.classList.add('fa-folder');
              
              // 2. Set display:none immediately to prevent any visual glitches
              folderContents.style.display = 'none';
              
              // 3. Add collapsed class
              folderContents.classList.add('collapsed');
              
              // 4. Process any nested folders
              const nestedFolderContainers = folderContents.querySelectorAll('.folder-contents:not(.collapsed)');
              const nestedFolderIcons = folderContents.querySelectorAll('.fa-folder-open');
              
              // Close each nested folder container
              nestedFolderContainers.forEach(container => {
                container.classList.add('collapsed');
                container.style.display = 'none';
              });
              
              // Update each nested folder icon
              nestedFolderIcons.forEach(icon => {
                icon.classList.remove('fa-folder-open');
                icon.classList.add('fa-folder');
              });
              
              // 5. Final check to ensure it stays closed
              setTimeout(() => {
                folderContents.classList.add('collapsed');
                folderContents.style.display = 'none';
                updateTreeLines(container);
                
                // Reset processing flag
                folderDiv.dataset.processing = 'false';
                folderDiv.classList.remove('active');
              }, 50);
            } 
            // When opening a folder
            else {
              // 1. First update the icon
              folderIcon.classList.remove('fa-folder');
              folderIcon.classList.add('fa-folder-open');
              
              // 2. Ensure all the CSS properties for collapsed state are removed
              folderContents.classList.remove('collapsed');
              folderContents.style.display = 'block';
              folderContents.style.visibility = 'visible';
              folderContents.style.height = 'auto';
              folderContents.style.position = 'relative';
              folderContents.style.zIndex = 'auto';
              folderContents.style.opacity = '1';
              folderContents.style.maxHeight = 'none';
              
              // 3. Force a browser reflow to ensure styles are applied
              void folderContents.offsetHeight;
              
              // 4. Update tree lines
              setTimeout(() => {
                updateTreeLines(container);
                
                // Reset processing flag
                folderDiv.dataset.processing = 'false';
                folderDiv.classList.remove('active');
              }, 50);
            }
          });
        } catch (err) {
          console.error("Error processing folder icon:", err);
        }
      });
      
      // Initial update of tree lines
      updateTreeLines(container);
    }

    // Helper function to ensure tree line consistency
    function updateTreeLines(container) {
      try {
        const allItems = container.querySelectorAll('.flex.items-start');
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
      } catch (err) {
        console.error("Error updating tree lines:", err);
      }
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
      // Initial initialization attempt
      initializeDirectoryTrees();
      
      // Also try again after a delay to handle dynamically loaded content
      setTimeout(initializeDirectoryTrees, 1000);
    });

    // Re-initialize on window load to catch any late-loading content
    window.addEventListener('load', function() {
      setTimeout(initializeDirectoryTrees, 300);
      
      // Try once more after a longer delay
      setTimeout(initializeDirectoryTrees, 2000);
    });
    
    // Use MutationObserver to watch for directory trees being added to the DOM
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
          // Check if any of the added nodes are directory trees or contain directory trees
          let hasDirectoryTree = false;
          
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1 && (
                node.classList && node.classList.contains('directory-tree') || 
                node.querySelector && node.querySelector('.directory-tree')
              )) {
              hasDirectoryTree = true;
            }
          });
          
          if (hasDirectoryTree) {
            console.log("Directory tree added to DOM, initializing...");
            setTimeout(initializeDirectoryTrees, 100);
          }
        }
      });
    });
    
    // Start observing the document with the configured parameters
    // Only observe if body is available
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      // If body isn't available yet, wait for it
      document.addEventListener('DOMContentLoaded', function() {
        observer.observe(document.body, { childList: true, subtree: true });
      });
    }

    // Provide a global function that can be called manually if needed
    window.reinitializeDirectoryTrees = initializeDirectoryTrees;

  })(); // End IIFE 
} 