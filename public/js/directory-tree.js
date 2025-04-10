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
    // Track initialization state
    let isInitialized = false;
    
    // Store directory tree container references to avoid reinitializing them
    const initializedContainers = new Set();
    
    // Promise-based approach to wait for directory trees
    function waitForDirectoryTrees(timeout = 5000) {
      return new Promise((resolve, reject) => {
        // Check if directory trees already exist
        const containers = document.querySelectorAll('.directory-tree');
        if (containers.length > 0) {
          return resolve(containers);
        }
        
        // Set a timeout to avoid waiting indefinitely
        const timeoutId = setTimeout(() => {
          // Disconnect the observer to avoid memory leaks
          if (observer) observer.disconnect();
          // Resolve with whatever containers we can find, even if none
          resolve(document.querySelectorAll('.directory-tree'));
        }, timeout);
        
        // Create a mutation observer to watch for directory trees
        const observer = new MutationObserver((mutations) => {
          const containers = document.querySelectorAll('.directory-tree');
          if (containers.length > 0) {
            clearTimeout(timeoutId);
            observer.disconnect();
            resolve(containers);
          }
        });
        
        // Start observing
        observer.observe(document.body, { childList: true, subtree: true });
      });
    }
    
    // Main initialization function (returns a Promise)
    function initializeDirectoryTrees() {
      // Only proceed if body exists
      if (!document.body) {
        return Promise.resolve(false);
      }
      
      return waitForDirectoryTrees()
        .then(containers => {
          if (containers.length === 0) {
            console.log("No directory tree containers found");
            return false;
          }
          
          // Initialize each directory tree container that hasn't been initialized yet
          containers.forEach(container => {
            // Skip if already initialized
            if (initializedContainers.has(container) || container.dataset.initialized === 'true') {
              return;
            }
            
            // Process non-empty containers
            if (container.innerHTML.trim() !== '') {
              // Mark as initialized
              container.dataset.initialized = 'true';
              initializedContainers.add(container);
              
              // Initialize the folder structure
              initDirectoryTree(container);
            } 
            // If container is empty but has infohash, we may need to fetch data
            else if (container.dataset.infohash) {
              console.log(`Directory tree for ${container.dataset.infohash} is empty, may need to fetch data`);
              // We'll leave it uninitialized so we can try again later
            }
          });
          
          // Mark global initialization as complete
          isInitialized = true;
          return true;
        })
        .catch(err => {
          console.error("Error initializing directory trees:", err);
          return false;
        });
    }
    
    // Helper function to fix any invalid folder states (run once after initialization)
    function ensureProperFolderState() {
      // Only run this once after a short delay
      setTimeout(() => {
        // Find any open folders with collapsed state that shouldn't be visible
        const invalidFolders = document.querySelectorAll('.folder-contents.collapsed:not([style*="display: none"])');
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
      }, 1000);
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
            
            // Set processing flag immediately and keep it for the duration of the operation
            folderDiv.dataset.processing = 'true';
            
            // Add visual feedback animation
            folderDiv.classList.add('active');
            
            // When closing a folder
            if (isClosing) {
              // Create a non-animated close function that can be reused
              const closeFolder = () => {
                // 1. First update the icon
                folderIcon.classList.remove('fa-folder-open');
                folderIcon.classList.add('fa-folder');
                
                // 2. Set display:none immediately to prevent any visual glitches
                folderContents.style.display = 'none';
                
                // 3. Add collapsed class
                folderContents.classList.add('collapsed');
                
                // 4. Apply all other CSS properties to ensure it stays closed
                folderContents.style.visibility = 'hidden';
                folderContents.style.height = '0';
                folderContents.style.position = 'absolute';
                folderContents.style.zIndex = '-1';
                folderContents.style.opacity = '0';
                folderContents.style.maxHeight = '0';
                
                // 5. Process any nested folders
                const nestedFolderContainers = folderContents.querySelectorAll('.folder-contents:not(.collapsed)');
                const nestedFolderIcons = folderContents.querySelectorAll('.fa-folder-open');
                
                // Close each nested folder container
                nestedFolderContainers.forEach(container => {
                  container.classList.add('collapsed');
                  container.style.display = 'none';
                  container.style.visibility = 'hidden';
                  container.style.height = '0';
                });
                
                // Update each nested folder icon
                nestedFolderIcons.forEach(icon => {
                  icon.classList.remove('fa-folder-open');
                  icon.classList.add('fa-folder');
                });
              };
              
              // Close the folder immediately
              closeFolder();
              
              // Apply the update tree lines after DOM updates have been applied
              setTimeout(() => {
                // Force close again to handle any race condition
                closeFolder();
                
                // Update tree lines
                updateTreeLines(container);
                
                // Wait a bit more before removing the processing state to prevent immediate reopening
                setTimeout(() => {
                  // Reset processing flag
                  folderDiv.dataset.processing = 'false';
                  folderDiv.classList.remove('active');
                  
                  // Final check that it stayed closed
                  if (!folderIcon.classList.contains('fa-folder')) {
                    closeFolder();
                  }
                }, 100);
              }, 50);
            } 
            // When opening a folder
            else {
              // Create a non-animated open function that can be reused
              const openFolder = () => {
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
              };
              
              // Open the folder immediately
              openFolder();
              
              // Force a browser reflow to ensure styles are applied
              void folderContents.offsetHeight;
              
              // Update tree lines after DOM updates have been applied
              setTimeout(() => {
                // Force open again to handle any race condition
                openFolder();
                
                // Update tree lines
                updateTreeLines(container);
                
                // Wait a bit more before removing the processing state
                setTimeout(() => {
                  // Reset processing flag
                  folderDiv.dataset.processing = 'false';
                  folderDiv.classList.remove('active');
                  
                  // Final check that it stayed open
                  if (!folderIcon.classList.contains('fa-folder-open')) {
                    openFolder();
                  }
                }, 100);
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
          // Convert comma-separated paths to slashes if no slashes exist
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
        // First convert commas to slashes if there are no slashes
        if (filePaths.includes(',') && !filePaths.includes('/')) {
          filePaths = filePaths.replace(/,/g, '/');
        }
        
        const fileArray = filePaths.includes('/') 
          ? filePaths.split(/[\/\\]/).map(f => f.trim()).filter(f => f)
          : filePaths.split(',').map(f => f.trim()).filter(f => f);
        
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

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        initializeDirectoryTrees().then(success => {
          if (success) ensureProperFolderState();
        });
      });
    } else {
      // DOM already loaded, initialize immediately
      initializeDirectoryTrees().then(success => {
        if (success) ensureProperFolderState();
      });
    }

    // Also try one more time after the window fully loads
    window.addEventListener('load', function() {
      initializeDirectoryTrees().then(success => {
        if (success) ensureProperFolderState();
      });
    });
    
    // Use MutationObserver to watch for new directory trees added to the DOM after initialization
    const contentObserver = new MutationObserver(function(mutations) {
      let hasNewTrees = false;
      
      mutations.forEach(function(mutation) {
        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(function(node) {
            // Check if this node is a directory tree or contains one
            if (node.nodeType === 1) {
              const newTrees = node.classList && node.classList.contains('directory-tree') ? 
                [node] : node.querySelectorAll && Array.from(node.querySelectorAll('.directory-tree'));
              
              if (newTrees && newTrees.length > 0) {
                // Check if any of these trees are not yet initialized
                const uninitializedTrees = newTrees.filter(tree => 
                  !initializedContainers.has(tree) && tree.dataset.initialized !== 'true'
                );
                
                if (uninitializedTrees.length > 0) {
                  hasNewTrees = true;
                }
              }
            }
          });
        }
      });
      
      // Only reinitialize if we found new uninitialized trees
      if (hasNewTrees) {
        initializeDirectoryTrees();
      }
    });
    
    // Start observing after initial initialization
    if (document.body) {
      contentObserver.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        contentObserver.observe(document.body, { childList: true, subtree: true });
      });
    }

    // Provide a global function that can be called manually if needed
    window.reinitializeDirectoryTrees = initializeDirectoryTrees;

    // Make initializeDirectoryTrees and initializeTreesInElement available globally
    // This ensures other scripts can access these functions
    window.initializeDirectoryTrees = initializeDirectoryTrees;
    window.initializeTreesInElement = function(element) {
      if (!element) return;
      
      const treeDivs = element.querySelectorAll('.directory-tree');
      treeDivs.forEach(container => {
        // Skip if already initialized
        if (initializedContainers.has(container) || container.dataset.initialized === 'true') {
          return;
        }
        
        // Only process non-empty containers
        if (container.innerHTML.trim() !== '') {
          // Mark as initialized
          container.dataset.initialized = 'true';
          initializedContainers.add(container);
          
          // Initialize the folder structure
          initDirectoryTree(container);
        }
      });
    };

  })(); // End IIFE 
} 