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
    
    // Main initialization function with retry capability
    function initializeDirectoryTrees(forceReinit = false) {
      try {
        console.log("Initializing directory trees...");
        const containers = document.querySelectorAll('.directory-tree');
        
        if (containers.length === 0) {
          initAttempts++;
          if (initAttempts > MAX_INIT_ATTEMPTS) {
            console.log(`Maximum initialization attempts (${MAX_INIT_ATTEMPTS}) reached, giving up.`);
            return;
          }
          
          console.log(`No directory tree containers found, will retry later (attempt ${initAttempts}/${MAX_INIT_ATTEMPTS})`);
          // Retry after a delay if no containers found
          clearTimeout(initRetryTimeout);
          initRetryTimeout = setTimeout(() => initializeDirectoryTrees(), 300);
          return;
        }
        
        console.log(`Found ${containers.length} directory tree containers`);
        
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
          
          // Log container content
          console.log(`Container #${index} contents:`, container.innerHTML.trim().substring(0, 100) + '...');
          
          // Check if container has content
          if (container.innerHTML.trim() === '') {
            console.log(`Container #${index} is empty, skipping initialization`);
            return;
          }
          
          console.log(`Initializing container #${index} with ${container.children.length} child elements`);
          
          // Mark as initialized
          container.dataset.initialized = 'true';
          
          // Initialize the folder structure
          initDirectoryTree(container);
          containersInitialized++;
        });
        
        console.log(`Directory trees initialization complete: ${containersInitialized} initialized, ${containersSkipped} skipped`);
        
        // If we found containers but couldn't initialize any, try once more with force=true
        if (containersInitialized === 0 && containersSkipped > 0 && !forceReinit) {
          console.log("No containers were initialized but some were found, attempting force reinitialization...");
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
        console.log("No folder icons found in container:", container);
        
        // Debug the container contents
        console.log("Container HTML content:", container.innerHTML);
        
        // If container is empty but has infohash data, try to retry later
        if (container.innerHTML.trim() === '' && container.dataset.infohash) {
          console.log("Container is empty but has infohash data, will try again later");
          
          // Reset initialization flag to try again
          container.dataset.initialized = 'false';
          
          // Try again after a delay
          setTimeout(() => {
            if (container.innerHTML.trim() !== '') {
              console.log("Container now has content, re-initializing");
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
            console.warn("Could not find parent folder div for icon:", icon);
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
            
            // Add a visual feedback animation
            folderDiv.classList.add('active');
            setTimeout(() => folderDiv.classList.remove('active'), 600);
            
            // Toggle between folder and folder-open icons
            const folderIcon = folderDiv.querySelector('.fa-folder, .fa-folder-open');
            if (!folderIcon) return;
            
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
            setTimeout(() => updateTreeLines(container), 300);
          });
        } catch (err) {
          console.error("Error processing folder icon:", err, icon);
        }
      });
      
      // Initialize collapse/expand all buttons
      initCollapseExpandButtons(container);
      
      // Initial update of tree lines
      updateTreeLines(container);
    }

    // Initialize collapse/expand all buttons
    function initCollapseExpandButtons(container) {
      // Find closest parent container that might contain the buttons
      const directoryTreeContainer = container.closest('.bg-gray-50') || container.closest('.container') || document;
      
      // Look for buttons by ID or class within this container
      const collapseAllBtnById = directoryTreeContainer.querySelector('#collapse-all');
      const expandAllBtnById = directoryTreeContainer.querySelector('#expand-all');
      const collapseAllBtnByClass = directoryTreeContainer.querySelector('.collapse-all');
      const expandAllBtnByClass = directoryTreeContainer.querySelector('.expand-all');
      
      // Use ID buttons if available, otherwise use class-based buttons
      const collapseAllBtn = collapseAllBtnById || collapseAllBtnByClass;
      const expandAllBtn = expandAllBtnById || expandAllBtnByClass;
      
      if (collapseAllBtn) {
        // Skip if the button already has a click handler
        if (collapseAllBtn.hasClickHandler) return;
        
        collapseAllBtn.hasClickHandler = true;
        collapseAllBtn.addEventListener('click', function(e) {
          e.preventDefault();
          
          // Add visual feedback
          collapseAllBtn.classList.add('active-btn');
          setTimeout(() => collapseAllBtn.classList.remove('active-btn'), 300);
          
          const folderIcons = container.querySelectorAll('.folder-toggle .fa-folder-open');
          folderIcons.forEach(folderIcon => {
            const folderDiv = folderIcon.closest('.folder-toggle');
            if (folderDiv) {
              folderDiv.click();
            }
          });
        });
      }
      
      if (expandAllBtn) {
        // Skip if the button already has a click handler
        if (expandAllBtn.hasClickHandler) return;
        
        expandAllBtn.hasClickHandler = true;
        expandAllBtn.addEventListener('click', function(e) {
          e.preventDefault();
          
          // Add visual feedback
          expandAllBtn.classList.add('active-btn');
          setTimeout(() => expandAllBtn.classList.remove('active-btn'), 300);
          
          const folderIcons = container.querySelectorAll('.folder-toggle .fa-folder');
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
    observer.observe(document.body, { childList: true, subtree: true });

    // Provide a global function that can be called manually if needed
    window.reinitializeDirectoryTrees = initializeDirectoryTrees;

  })(); // End IIFE 
} 