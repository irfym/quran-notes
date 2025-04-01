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
  "131": "MAS Abdel Haleem",
  "149": "Saheeh International",
  "19": "Tafheem-ul-Quran (Urdu)",
  "22": "Abdul Majid Daryabadi",
  "85": "Mufti Taqi Usmani"
};

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

  arabicVerses.forEach(verse => {
    verse.classList.remove("highlight"); // Remove previous highlights
  });

  translationVerses.forEach(verse => {
    verse.classList.remove("highlight"); // Remove previous highlights
    if (verse.dataset.verse === verseNumber) {
      verse.classList.add("highlight"); // Highlight the correct verse

      // Scroll only inside the translation pane, NOT the whole window
      translationPane.scrollTo({
        top: verse.offsetTop - translationPane.offsetTop, 
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

  translationVerses.forEach(verse => {
    verse.classList.remove("highlight"); // Remove previous highlights
  });

  arabicVerses.forEach(verse => {
    verse.classList.remove("highlight"); // Remove previous highlights
    if (verse.dataset.verse === String(verseNumber)) { // Convert to string for comparison
      verse.classList.add("highlight"); // Highlight the correct verse

      // Scroll only inside the Arabic pane, NOT the whole window
      arabicPane.scrollTo({
        top: verse.offsetTop - arabicPane.offsetTop, 
        behavior: "smooth"
      });
    }
  });
}

async function loadSurah(surahNumber) {
  try {
    showLoadingState();
    const translationId = document.getElementById('translation-select').value;
    const [arabicResponse, translationResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/quran/verses/uthmani?chapter_number=${surahNumber}`),
      fetch(`${API_BASE_URL}/verses/by_chapter/${surahNumber}?translations=${translationId}&limit=999`)
    ]);

    if (!arabicResponse.ok) throw new Error(`Arabic request failed: ${arabicResponse.status}`);
    if (!translationResponse.ok) throw new Error(`Translation request failed: ${translationResponse.status}`);

    const arabicData = await arabicResponse.json();
    const translationData = await translationResponse.json();

    if (!arabicData.verses) throw new Error("No Arabic verses found");
    if (!translationData.verses) throw new Error("No translation verses found");

    updateSurahUI(surahNumber, arabicData.verses, translationData.verses);
  } catch (error) {
    console.error('Error loading surah:', error);
    showErrorState(error.message, true);
  }
}


async function updateSurahUI(surahNumber, arabicVerses, translationVerses) {
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
      translationVerses.forEach((verse) => {
        const verseNumber = verse.verse_number;
        const translationText = verse.translations[0].text;
        const translationVerse = document.createElement('div');
        translationVerse.className = 'verse';
        translationVerse.dataset.surah = surahNumber;
        translationVerse.dataset.verse = verseNumber;
        translationVerse.innerHTML = `${translationText} <span class="verse-number">${verseNumber}</span>`;

        // Click event to highlight corresponding Arabic verse
        translationVerse.addEventListener("click", () => highlightArabicVerse(verseNumber));

        translationPane.appendChild(translationVerse);
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

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
  loadSurahList();
  setupVerseSelection();
  setupMarkdownEditor();
  setupResizeHandles();
  setupTabs();

  document.getElementById('surah-selector').addEventListener('change', function() {
    const surahNumber = this.value;
    if (surahNumber) loadSurah(surahNumber);
  });

  document.getElementById('translation-select').addEventListener('change', function() {
    const surahSelector = document.getElementById('surah-selector');
    if (surahSelector.value) {
      loadSurah(surahSelector.value);
    }
  });

  // Load saved translation preference
  const savedTranslation = localStorage.getItem('preferredTranslation');
  if (savedTranslation) {
    document.getElementById('translation-select').value = savedTranslation;
  }

  // Save translation preference when changed
  document.getElementById('translation-select').addEventListener('change', function() {
    localStorage.setItem('preferredTranslation', this.value);
  });
});
