// Configure marked and highlight.js
marked.setOptions({
  breaks: true,
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(lang, code).value;
    }
    return hljs.highlightAuto(code).value;
  }
});

// API Configuration
const API_BASE_URL = 'https://api.quran.com/api/v4';
const TRANSLATIONS = {
  // Original translations
  "85": "M.A.S. Abdel Haleem (Abdul Haleem)",
  "131": "Dr. Mustafa Khattab, The Clear Quran (Dr. Mustafa Khattab)",
  "84": "T. Usmani (Mufti Taqi Usmani)",
  "95": "A. Maududi (Tafhim commentary) (Sayyid Abul Ala Maududi)",
  "19": "M. Pickthall (Mohammed Marmaduke William Pickthall)",
  "22": "A. Yusuf Ali (Abdullah Yusuf Ali)",
  "20": "Saheeh International (Saheeh International)",
  "203": "Al-Hilali & Khan (Muhammad Taqi-ud-Din al-Hilali & Muhammad Muhsin Khan)",
  "57": "Transliteration (Transliteration)"
  // "131": "MAS Abdel Haleem",
  // "149": "Saheeh International",
  // "20": "Yusuf Ali",
  // "17": "Dr. Ghali",
  // "84": "Muhsin Khan",
  // "82": "Muhammad Asad",
  // "75": "A.J. Arberry",
  // "93": "T.B. Irving",
  // "134": "The Study Quran",
  // "203": "Ali Ünal",
  // "207": "Mustafa Khattab",
  // "95": "Muhammad Sarwar",
  // "57": "Syed Vickar Ahamed",
  // "171": "Dr. Mustafa Khattab",
  // "127": "Tafsir al-Jalalayn (Eng)",
  // "54": "Maududi",
  // "199": "The Noble Quran",
  // "22": "Abdul Majid Daryabadi",
  // "85": "Mufti Taqi Usmani"
};

async function getAllTranslations() {
  try {
    const response = await fetch('https://api.quran.com/api/v4/resources/translations');
    const data = await response.json();
    
    // Filter English translations
    const englishTranslations = data.translations.filter(t => t.language_name === 'English');
    console.log("English Translations:", englishTranslations);
    
    // Or see all translations grouped by language
    const byLanguage = {};
    data.translations.forEach(t => {
      if (!byLanguage[t.language_name]) byLanguage[t.language_name] = [];
      byLanguage[t.language_name].push(`${t.id}: ${t.name} (${t.author_name})`);
    });
    console.log("All Translations by Language:", byLanguage);
    
    return data.translations;
  } catch (error) {
    console.error('Error fetching translations:', error);
    return [];
  }
}

// To handle loading and saving notes
let notesDirectoryHandle = null;
const NOTES_FILE_PATTERN = /^Surah_(\d+)_(.+)_Notes\.md$/i;

// Core Functions

function updatePreview() {
  const editor = document.getElementById('notes-editor');
  const preview = document.getElementById('notes-preview');
  if (editor && preview) {
    preview.innerHTML = marked.parse(editor.value);
    document.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
    });
  }
}

function showLoadingState() {
  const arabicPane = document.getElementById('arabic-text');
  const translationPane = document.getElementById('translation-text');

  if (arabicPane) {
    arabicPane.innerHTML = `
      <div class="text-center py-5">
        <div class="loading"></div>
        <p>Loading...</p>
      </div>
    `;
  }

  if (translationPane) {
    translationPane.innerHTML = `
      <div class="text-center py-5">
        <div class="loading"></div>
        <p>Loading...</p>
      </div>
    `;
  }
}

// Function to populate translation dropdown with all available translations
function populateTranslationDropdown() {
  const translationSelect = document.getElementById('translation-select');
  if (!translationSelect) return;
  
  // Clear existing options
  translationSelect.innerHTML = '';
  
  // Add all translations from our config object
  Object.entries(TRANSLATIONS).forEach(([id, name]) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = name;
    translationSelect.appendChild(option);
  });
  
  // Load saved preferences
  const savedTranslations = localStorage.getItem('preferredTranslations');
  if (savedTranslations) {
    try {
      const translationIds = JSON.parse(savedTranslations);
      
      // Select the saved translations
      Array.from(translationSelect.options).forEach(option => {
        option.selected = translationIds.includes(option.value);
      });
    } catch (e) {
      console.error('Error parsing saved translations', e);
      // Set default if there's an error
      translationSelect.value = '131'; // Default to MAS Abdel Haleem
    }
  } else {
    // Set a default translation if nothing is saved
    translationSelect.value = '131'; // Default to MAS Abdel Haleem
  }
}

function showErrorState(message = 'Error loading data', showRetry = false) {
  const arabicPane = document.getElementById('arabic-text');
  const translationPane = document.getElementById('translation-text');

  const retryButton = showRetry ? '<button class="retry-btn" onclick="window.location.reload()">Retry</button>' : '';

  if (arabicPane) {
    arabicPane.innerHTML = `
      <div class="text-center py-5 text-danger">
        <i class="fas fa-exclamation-triangle fa-2x"></i>
        <p>${message}</p>
        ${retryButton}
      </div>
    `;
  }

  if (translationPane) {
    translationPane.innerHTML = `
      <div class="text-center py-5 text-danger">
        <i class="fas fa-exclamation-triangle fa-2x"></i>
        <p>${message}</p>
      </div>
    `;
  }
}

async function loadSurahList() {
  try {
    showLoadingState();
    const response = await fetch(`${API_BASE_URL}/chapters?language=en`);
    if (!response.ok) throw new Error("Failed to fetch surah list");
    const data = await response.json();
    const surahSelector = document.getElementById('surah-selector');
    if (surahSelector) {
      surahSelector.innerHTML = '<option value="">Select Surah...</option>';
      data.chapters.forEach(surah => {
        const option = document.createElement('option');
        option.value = surah.id;
        option.textContent = `${surah.id}. ${surah.name_simple} (${surah.translated_name.name})`;
        surahSelector.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error loading surah list:', error);
    showErrorState('Failed to load surah list. Please try again later.', true);
  }
}

// Function to highlight and scroll to the corresponding translation verse
function highlightTranslationVerse(verseNumber) {
  const translationPane = document.getElementById('translation-text');
  const translationVerses = document.querySelectorAll("#translation-text .verse");
  const arabicVerses = document.querySelectorAll("#arabic-text .verse");
  const arabicPane = document.getElementById('arabic-text');

  // Remove previous highlights from both panes
  arabicVerses.forEach(verse => {
    verse.classList.remove("highlight");
  });

  translationVerses.forEach(verse => {
    verse.classList.remove("highlight");
  });

  // Highlight and scroll in translation pane
  translationVerses.forEach(verse => {
    if (verse.dataset.verse === verseNumber) {
      verse.classList.add("highlight");
      
      // Scroll in translation pane
      translationPane.scrollTo({
        top: verse.offsetTop - translationPane.offsetTop, 
        behavior: "smooth"
      });
    }
  });

  // Also highlight and scroll in Arabic pane
  arabicVerses.forEach(verse => {
    if (verse.dataset.verse === String(verseNumber)) {
      verse.classList.add("highlight");
      
      // Scroll in Arabic pane
      arabicPane.scrollTo({
        top: verse.offsetTop - arabicPane.offsetTop, 
        behavior: "smooth"
      });
    }
  });
}

// Function to highlight & scroll to corresponding Arabic verse
function highlightArabicVerse(verseNumber) {
  const translationVerses = document.querySelectorAll("#translation-text .verse");
  const arabicPane = document.getElementById('arabic-text');
  const arabicVerses = document.querySelectorAll("#arabic-text .verse");
  const translationPane = document.getElementById('translation-text');

  // Remove previous highlights from both panes
  translationVerses.forEach(verse => {
    verse.classList.remove("highlight");
  });

  arabicVerses.forEach(verse => {
    verse.classList.remove("highlight");
  });

  // Highlight and scroll to Arabic verse
  arabicVerses.forEach(verse => {
    if (verse.dataset.verse === String(verseNumber)) {
      verse.classList.add("highlight");
      
      // Scroll only inside the Arabic pane
      arabicPane.scrollTo({
        top: verse.offsetTop - arabicPane.offsetTop, 
        behavior: "smooth"
      });
    }
  });

  // Also highlight and scroll to matching translation verse
  translationVerses.forEach(verse => {
    if (verse.dataset.verse === String(verseNumber)) {
      verse.classList.add("highlight");
      
      // Scroll to the verse in translation pane as well
      translationPane.scrollTo({
        top: verse.offsetTop - translationPane.offsetTop, 
        behavior: "smooth"
      });
    }
  });
}

async function loadSurah(surahNumber, preservePosition = false) {
  try {
    // Remember the current highlighted verse if preservePosition is true
    let currentHighlightedVerseNumber = null;
    
    if (preservePosition) {
      // Check for highlighted verses in both panes
      const highlightedArabicVerse = document.querySelector("#arabic-text .verse.highlight");
      const highlightedTranslationVerse = document.querySelector("#translation-text .verse.highlight");
      
      // Get the verse number from whichever one is highlighted
      if (highlightedArabicVerse) {
        currentHighlightedVerseNumber = highlightedArabicVerse.dataset.verse;
      } else if (highlightedTranslationVerse) {
        currentHighlightedVerseNumber = highlightedTranslationVerse.dataset.verse;
      } else {
        // If no verse is highlighted, try to get a visible verse instead
        // First check translation pane for visible verses
        const translationPane = document.getElementById('translation-text');
        const translationVerses = document.querySelectorAll("#translation-text .verse");
        
        if (translationPane && translationVerses.length > 0) {
          // Find a verse that's currently visible in the viewport
          const paneRect = translationPane.getBoundingClientRect();
          
          for (const verse of translationVerses) {
            const verseRect = verse.getBoundingClientRect();
            // Check if the verse is visible within the pane
            if (verseRect.top >= paneRect.top && 
                verseRect.bottom <= paneRect.bottom) {
              currentHighlightedVerseNumber = verse.dataset.verse;
              break;
            }
          }
        }
        
        // If still no verse found, check Arabic pane
        if (!currentHighlightedVerseNumber) {
          const arabicPane = document.getElementById('arabic-text');
          const arabicVerses = document.querySelectorAll("#arabic-text .verse");
          
          if (arabicPane && arabicVerses.length > 0) {
            const paneRect = arabicPane.getBoundingClientRect();
            
            for (const verse of arabicVerses) {
              const verseRect = verse.getBoundingClientRect();
              if (verseRect.top >= paneRect.top && 
                  verseRect.bottom <= paneRect.bottom) {
                currentHighlightedVerseNumber = verse.dataset.verse;
                break;
              }
            }
          }
        }
      }
    }
    
    showLoadingState();
    
    // Get selected translations as an array
    const translationSelect = document.getElementById('translation-select');
    const selectedTranslations = Array.from(translationSelect.selectedOptions).map(option => option.value);
    
    // Default to a standard translation if nothing is selected
    if (selectedTranslations.length === 0) {
      selectedTranslations.push('131'); // MAS Abdel Haleem as default
      translationSelect.value = '131';
    }
    
    // Join translations with comma for API call
    const translationIds = selectedTranslations.join(',');
    
    const [arabicResponse, translationResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/quran/verses/uthmani?chapter_number=${surahNumber}`),
      fetch(`${API_BASE_URL}/verses/by_chapter/${surahNumber}?translations=${translationIds}&limit=999`)
    ]);

    if (!arabicResponse.ok) throw new Error(`Arabic request failed: ${arabicResponse.status}`);
    if (!translationResponse.ok) throw new Error(`Translation request failed: ${translationResponse.status}`);

    const arabicData = await arabicResponse.json();
    const translationData = await translationResponse.json();

    if (!arabicData.verses) throw new Error("No Arabic verses found");
    if (!translationData.verses) throw new Error("No translation verses found");

    await updateSurahUI(surahNumber, arabicData.verses, translationData.verses, selectedTranslations);
    
    // After UI is updated, scroll to the previously highlighted verse if we have one
    if (preservePosition && currentHighlightedVerseNumber) {
      setTimeout(() => {
        // Using highlightArabicVerse will now highlight and scroll both panes
        highlightArabicVerse(currentHighlightedVerseNumber);
      }, 300); // Increased timeout to ensure DOM has fully updated
    }
  } catch (error) {
    console.error('Error loading surah:', error);
    showErrorState(error.message, true);
  }
}

async function updateSurahUI(surahNumber, arabicVerses, translationVerses, selectedTranslations) {
  try {
    // Fetch Surah name
    const response = await fetch(`https://api.quran.com/api/v4/chapters/${surahNumber}`);
    const surahData = await response.json();
    const surahName = surahData.chapter.name_arabic; // Arabic Surah name
    const surahNameEnglish = surahData.chapter.name_simple; // English Surah name

    // Update headers
    document.getElementById('arabic-surah-name').textContent = `سورة ${surahName}`;
    document.getElementById('translation-surah-name').textContent = `Surah ${surahNameEnglish}, Chapter ${surahNumber}`;
    document.getElementById('arabic-surah-info').textContent = ` آيات ${arabicVerses.length}`;
    document.getElementById('translation-surah-info').textContent = `${translationVerses.length} verses`;

    // Update panes
    const arabicPane = document.getElementById('arabic-text');
    const translationPane = document.getElementById('translation-text');
    const verseSelector = document.getElementById('verse-selector'); // Get dropdown
    if (arabicPane) arabicPane.innerHTML = '';
    if (translationPane) translationPane.innerHTML = '';

    // Clear previous content
    if (arabicPane) arabicPane.innerHTML = '';
    if (translationPane) translationPane.innerHTML = '';
    if (verseSelector) verseSelector.innerHTML = '<option value="" disabled selected>Select a verse</option>';

    // Add Arabic verses
    if (arabicPane) {
      arabicVerses.forEach((verse) => {
        const verseNumber = verse.verse_key ? verse.verse_key.split(":")[1] : ""; 
        const arabicText = verse.text_uthmani || "";

        const arabicVerse = document.createElement("div");
        arabicVerse.className = "verse";
        arabicVerse.dataset.surah = surahNumber;
        arabicVerse.dataset.verse = verseNumber;

        const verseNumberHTML = verseNumber ? `<span class="verse-number">${verseNumber}</span>` : "";
        arabicVerse.innerHTML = `${arabicText} ${verseNumberHTML}`;

        // Add click event to highlight corresponding translation verse
        arabicVerse.addEventListener("click", () => highlightTranslationVerse(verseNumber));
    
        arabicPane.appendChild(arabicVerse);

        // Populate dropdown with verse numbers
        if (verseSelector) {
          const option = document.createElement("option");
          option.value = verseNumber;
          option.textContent = `Verse ${verseNumber}`;
          verseSelector.appendChild(option);
        }
      });
    }

    // Add event listener for dropdown to scroll to selected verse
    if (verseSelector) {
      verseSelector.addEventListener("change", (event) => {
        highlightArabicVerse(event.target.value);
      });
    }

    // Add Translation verses
    if (translationPane) {
      // Create a map of verse number to translations in the correct order
      const verseGroups = {};
      
      translationVerses.forEach((verse) => {
          const verseNumber = verse.verse_number;
          
          if (!verseGroups[verseNumber]) {
              verseGroups[verseNumber] = {
                  surah: surahNumber,
                  verse: verseNumber,
                  translations: []
              };
          }
          
          // Create an array with null values to maintain order
          if (verseGroups[verseNumber].translations.length === 0) {
              verseGroups[verseNumber].translations = selectedTranslations.map(id => null);
          }
          
          // Place each translation in its correct position
          verse.translations.forEach((translation, index) => {
              const translationIndex = selectedTranslations.indexOf(translation.resource_id.toString());
              if (translationIndex !== -1) {
                  verseGroups[verseNumber].translations[translationIndex] = {
                      id: translation.resource_id.toString(),
                      text: translation.text
                  };
              }
          });
      });
      
      // Create verse elements with all translations in correct order
      Object.values(verseGroups).forEach(group => {
          const verseContainer = document.createElement('div');
          verseContainer.className = 'verse';
          verseContainer.dataset.surah = group.surah;
          verseContainer.dataset.verse = group.verse;
          
          let verseContent = `<span class="verse-number">${group.verse}</span><br>`;
          
          // Add translations in the correct selected order
          group.translations.forEach((translation, index) => {
              if (translation) {
                  const translatorName = TRANSLATIONS[translation.id] || `Translation ${index + 1}`;
                  verseContent += `
                      <div class="translation-wrapper">
                          <div class="translation-header">${translatorName}</div>
                          <div class="translation-text">${translation.text}</div>
                      </div>
                  `;
              }
          });
          
          verseContainer.innerHTML = verseContent;
          
          // Click event to highlight corresponding Arabic verse
          verseContainer.addEventListener("click", () => highlightArabicVerse(group.verse));
          
          translationPane.appendChild(verseContainer);
      });
    }

    // Add editor content
    const editor = document.getElementById('notes-editor');
    if (editor) {
      editor.value = localStorage.getItem(`surah_notes_${surahNumber}`) || '';
      updatePreview();
    }
    document.getElementById('current-surah-info').textContent = `Surah ${surahNameEnglish}`;

  } catch (error) {
    console.error("Error updating Surah UI:", error);
  }
}

function setupVerseSelection() {
  const arabicPane = document.getElementById('arabic-text');
  const translationPane = document.getElementById('translation-text');

  if (arabicPane) {
    arabicPane.addEventListener('click', function(e) {
      const verseElement = e.target.closest('.verse');
      if (verseElement) {
        document.querySelectorAll('.verse').forEach(el => el.classList.remove('selected'));
        verseElement.classList.add('selected');
      }
    });
  }

  if (translationPane) {
    translationPane.addEventListener('click', function(e) {
      const verseElement = e.target.closest('.verse');
      if (verseElement) {
        document.querySelectorAll('.verse').forEach(el => el.classList.remove('selected'));
        verseElement.classList.add('selected');
      }
    });
  }
}

function setupMarkdownEditor() {
  const editor = document.getElementById('notes-editor');
  const toolbarButtons = document.querySelectorAll('.editor-toolbar button');

  if (editor) {
    editor.addEventListener('input', function() {
      const surahSelector = document.getElementById('surah-selector');
      if (surahSelector.value) {
        localStorage.setItem(`surah_notes_${surahSelector.value}`, this.value);
      }
      updatePreview();
    });
  }

  if (toolbarButtons) {
    toolbarButtons.forEach(button => {
      button.addEventListener('click', function() {
        const command = this.dataset.command;
        insertMarkdownCommand(command);
      });
    });
  }

  function insertMarkdownCommand(command) {
    const editor = document.getElementById('notes-editor');
    if (!editor) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selectedText = editor.value.substring(start, end);
    let newText = '';

    switch (command) {
      case 'bold': newText = `**${selectedText}**`; break;
      case 'italic': newText = `*${selectedText}*`; break;
      case 'heading': newText = `# ${selectedText}`; break;
      case 'quote': newText = `> ${selectedText}`; break;
      case 'code': newText = `\`${selectedText}\``; break;
      case 'link': newText = `[${selectedText}](url)`; break;
      case 'image': newText = `![alt text](${selectedText})`; break;
      case 'unorderedList': newText = `- ${selectedText}`; break;
      case 'orderedList': newText = `1. ${selectedText}`; break;
      default: return;
    }

    editor.value = editor.value.substring(0, start) + newText + editor.value.substring(end);
    const newCursorPos = (command === 'link' || command === 'image')
      ? start + newText.length - 1
      : start + newText.length;
    editor.setSelectionRange(newCursorPos, newCursorPos);
    editor.focus();
    updatePreview();
  }
}

function setupResizeHandles() {
  const resizeHandle1 = document.getElementById('resize-handle-1');
  const resizeHandle2 = document.getElementById('resize-handle-2');
  const arabicPane = document.getElementById('arabic-pane');
  const translationPane = document.getElementById('translation-pane');
  const notesPane = document.getElementById('notes-pane');

  if (!resizeHandle1 || !resizeHandle2 || !arabicPane || !translationPane || !notesPane) return;

  let isResizing1 = false;
  let isResizing2 = false;

  resizeHandle1.addEventListener('mousedown', function(e) {
    isResizing1 = true;
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  });

  resizeHandle2.addEventListener('mousedown', function(e) {
    isResizing2 = true;
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  });

  document.addEventListener('mousemove', function(e) {
    if (!isResizing1 && !isResizing2) return;
    const containerWidth = document.querySelector('.container-fluid').offsetWidth;
    if (isResizing1) {
      const arabicWidth = (e.clientX / containerWidth) * 100;
      if (arabicWidth > 20 && arabicWidth < 50) {
        arabicPane.style.flex = `0 0 ${arabicWidth}%`;
        translationPane.style.flex = `0 0 ${100 - arabicWidth - 6}%`;
      }
    }
    if (isResizing2) {
      const translationWidth = ((e.clientX - arabicPane.offsetWidth - resizeHandle1.offsetWidth) / containerWidth) * 100;
      if (translationWidth > 20 && translationWidth < 50) {
        translationPane.style.flex = `0 0 ${translationWidth}%`;
        notesPane.style.flex = `0 0 ${100 - translationWidth - arabicPane.offsetWidth / containerWidth * 100 - 6}%`;
      }
    }
  });

  document.addEventListener('mouseup', function() {
    isResizing1 = false;
    isResizing2 = false;
    document.body.style.cursor = '';
  });
}

function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      tabButtons.forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
      this.classList.add('active');
      const tabId = this.dataset.tab + '-tab';
      document.getElementById(tabId).classList.add('active');
    });
  });
}

// Functions to handle notes directory selection and saving
async function selectNotesDirectory() {
  try {
    if (!('showDirectoryPicker' in window)) {
      alert('Directory selection is only supported in Chrome/Edge. Please use individual file operations instead.');
      return;
    }

    const handle = await window.showDirectoryPicker();
    notesDirectoryHandle = handle;
    document.getElementById('directory-status').textContent = `Selected: ${handle.name}`;
    localStorage.setItem('notesDirectory', handle.name);
    
    // Load all notes files from the directory
    await loadAllNotesFromDirectory();
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Error selecting directory:', error);
      alert('Error selecting directory');
    }
  }
}

async function loadAllNotesFromDirectory() {
  if (!notesDirectoryHandle) return;

  try {
    // Get all files in the directory
    const files = [];
    for await (const entry of notesDirectoryHandle.values()) {
      if (entry.kind === 'file' && entry.name.match(NOTES_FILE_PATTERN)) {
        files.push(entry);
      }
    }

    // Load each file's content
    for (const fileHandle of files) {
      const file = await fileHandle.getFile();
      const content = await file.text();
      const match = file.name.match(NOTES_FILE_PATTERN);
      
      if (match) {
        const surahNumber = match[1];
        // Store the content in localStorage under the surah key
        localStorage.setItem(`surah_notes_${surahNumber}`, content);
      }
    }

    // If a surah is currently selected, update its notes
    const currentSurah = document.getElementById('surah-selector').value;
    if (currentSurah) {
      const editor = document.getElementById('notes-editor');
      if (editor) {
        editor.value = localStorage.getItem(`surah_notes_${currentSurah}`) || '';
        updatePreview();
      }
    }

    alert(`Successfully loaded ${files.length} notes files`);
  } catch (error) {
    console.error('Error loading notes from directory:', error);
    alert('Error loading notes from directory');
  }
}

async function saveAllNotesToDirectory() {
  if (!notesDirectoryHandle) {
    alert('Please select a directory first');
    return;
  }

  try {
    let savedCount = 0;
    
    // Get all surahs that have notes
    const surahsWithNotes = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('surah_notes_')) {
        const surahNumber = key.replace('surah_notes_', '');
        surahsWithNotes.push(surahNumber);
      }
    }

    // Save each surah's notes to a file
    for (const surahNumber of surahsWithNotes) {
      const notes = localStorage.getItem(`surah_notes_${surahNumber}`);
      if (!notes) continue;

      const fileName = `${surahNumber}_notes.md`;
      
      try {
        // Check if file exists
        let fileHandle;
        try {
          fileHandle = await notesDirectoryHandle.getFileHandle(fileName, { create: false });
        } catch {
          // File doesn't exist, create it
          fileHandle = await notesDirectoryHandle.getFileHandle(fileName, { create: true });
        }

        // Create a writer
        const writable = await fileHandle.createWritable();
        await writable.write(notes);
        await writable.close();
        savedCount++;
      } catch (error) {
        console.error(`Error saving file ${fileName}:`, error);
      }
    }

    alert(`Successfully saved ${savedCount} notes files`);
  } catch (error) {
    console.error('Error saving all notes:', error);
    alert('Error saving all notes');
  }
}

// Function to save selected translations to localStorage
function saveSelectedTranslations() {
  const translationSelect = document.getElementById('translation-select');
  const selectedOptions = Array.from(translationSelect.selectedOptions).map(option => option.value);
  
  if (selectedOptions.length > 0) {
    localStorage.setItem('preferredTranslations', JSON.stringify(selectedOptions));
  }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
  loadSurahList();
  setupVerseSelection();
  setupMarkdownEditor();
  setupResizeHandles();
  setupTabs();
  populateTranslationDropdown(); // Add this line to populate translations

  document.getElementById('surah-selector').addEventListener('change', function() {
    const surahNumber = this.value;
    if (surahNumber) {
      loadSurah(surahNumber);
      localStorage.setItem('lastOpenedSurah', surahNumber);
    }
  });

  // Updated translation select event listener to handle multiple selections AND preserve position
  document.getElementById('translation-select').addEventListener('change', function() {
    saveSelectedTranslations();
    const surahSelector = document.getElementById('surah-selector');
    if (surahSelector.value) {
      loadSurah(surahSelector.value, true); // Pass true to preserve position
    }
  });

  // Event listeners for directory selection and saving notes
  document.getElementById('select-directory').addEventListener('click', selectNotesDirectory);
  document.getElementById('save-all-notes').addEventListener('click', saveAllNotesToDirectory);

  // Try to restore the last used directory name
  const lastDirectory = localStorage.getItem('notesDirectory');
  if (lastDirectory) {
    document.getElementById('directory-status').textContent = `Last used: ${lastDirectory}`;
  }

  // Load saved translation preferences
  const savedTranslations = localStorage.getItem('preferredTranslations');
  if (savedTranslations) {
    try {
      const translationIds = JSON.parse(savedTranslations);
      const translationSelect = document.getElementById('translation-select');
      
      // Clear any default selections
      Array.from(translationSelect.options).forEach(option => {
        option.selected = translationIds.includes(option.value);
      });
    } catch (e) {
      console.error('Error parsing saved translations', e);
    }
  } else {
    // Set a default translation if nothing is saved
    document.getElementById('translation-select').value = '131'; // Default to MAS Abdel Haleem
  }

  // Restore the last opened surah
  const lastOpenedSurah = localStorage.getItem('lastOpenedSurah');
  if (lastOpenedSurah) {
    const surahSelector = document.getElementById('surah-selector');
    surahSelector.value = lastOpenedSurah;
    loadSurah(lastOpenedSurah);
  }
});