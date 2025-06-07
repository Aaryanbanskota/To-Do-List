// DOM Elements
const addTaskBtn = document.getElementById('addTaskBtn');
const tasksContainer = document.getElementById('tasksContainer');

const addModal = document.getElementById('addModal');
const addTitleInput = document.getElementById('addTitle');
const addDescInput = document.getElementById('addDesc');
const addDueInput = document.getElementById('addDue');
const addImageInput = document.getElementById('addImage');
const recordVoiceBtn = document.getElementById('recordVoiceBtn');
const saveAddBtn = document.getElementById('saveAddBtn');
const cancelAddBtn = document.getElementById('cancelAddBtn');

const editModal = document.getElementById('editModal');
const editTitleInput = document.getElementById('editTitle');
const editDescInput = document.getElementById('editDesc');
const editDueInput = document.getElementById('editDue');
const editImageInput = document.getElementById('editImage');
const recordEditVoiceBtn = document.getElementById('recordEditVoiceBtn');
const saveEditBtn = document.getElementById('saveEditBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

const imagePreviewModal = document.getElementById('imagePreviewModal');
const imagePreviewImg = document.getElementById('imagePreview');
const closeImagePreviewBtn = document.getElementById('closeImagePreviewBtn');

const voiceRecordModal = document.getElementById('voiceRecordModal');
const startRecordingBtn = document.getElementById('startRecordingBtn');
const stopRecordingBtn = document.getElementById('stopRecordingBtn');
const audioPlayback = document.getElementById('audioPlayback');
const saveVoiceBtn = document.getElementById('saveVoiceBtn');
const cancelVoiceBtn = document.getElementById('cancelVoiceBtn');

// Data
let tasks = [];
let currentEditId = null;

// Voice recording vars
let mediaRecorder = null;
let audioChunks = [];
let currentVoiceBlob = null;
let isRecordingForEdit = false; // Flag to know if recording from edit modal

// Load tasks from localStorage
function loadTasks() {
  const stored = localStorage.getItem('tasks');
  tasks = stored ? JSON.parse(stored) : [];
}

// Save tasks to localStorage
function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

// Render all tasks as sticky notes
function renderTasks() {
  tasksContainer.innerHTML = '';

  tasks.forEach((task, index) => {
    const note = document.createElement('div');
    note.className = 'note';
    note.style.setProperty('--random', Math.random());

    const dueStr = task.due ? new Date(task.due).toLocaleString() : '';

    // Compose inner HTML
    note.innerHTML = `
      <button class="delete-btn" title="Delete task">×</button>
      <h3>${escapeHtml(task.title)}</h3>
      <p>${escapeHtml(task.description)}</p>
      ${dueStr ? `<small>Due: ${dueStr}</small>` : ''}
    `;

    // Add image if exists
    if (task.imageData) {
      const img = document.createElement('img');
      img.src = task.imageData;
      img.alt = 'Attached Image';
      img.className = 'task-image';
      img.title = 'Click to view full image';
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        openImagePreview(task.imageData);
      });
      note.appendChild(img);
    }

    // Add voice play button if exists
    if (task.voiceData) {
      const voiceBtn = document.createElement('button');
      voiceBtn.className = 'voice-play-btn';
      voiceBtn.title = 'Play Voice Recording';
      voiceBtn.innerHTML = '▶️';
      voiceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playVoice(task.voiceData);
      });
      note.appendChild(voiceBtn);
    }

    // Delete button handler
    note.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Delete this task?')) {
        tasks.splice(index, 1);
        saveTasks();
        renderTasks();
        scheduleNotifications();
      }
    });

    // Edit modal open on note click
    note.addEventListener('click', () => {
      currentEditId = index;
      const task = tasks[index];
      editTitleInput.value = task.title;
      editDescInput.value = task.description;
      editDueInput.value = task.due ? new Date(task.due).toISOString().slice(0,16) : '';
      editImageInput.value = ''; // Clear input for new image
      editModal.classList.remove('hidden');
      currentVoiceBlob = null; // reset voice on edit
    });

    tasksContainer.appendChild(note);
  });
}

// Escape HTML to prevent injection
function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[m]));
}

// Open add task modal
addTaskBtn.addEventListener('click', () => {
  addTitleInput.value = '';
  addDescInput.value = '';
  addDueInput.value = '';
  addImageInput.value = '';
  currentVoiceBlob = null;
  addModal.classList.remove('hidden');
});

// Cancel add modal
cancelAddBtn.addEventListener('click', () => {
  addModal.classList.add('hidden');
});

// Cancel edit modal
cancelEditBtn.addEventListener('click', () => {
  editModal.classList.add('hidden');
  currentEditId = null;
  currentVoiceBlob = null;
});

// Save new task
saveAddBtn.addEventListener('click', async () => {
  const title = addTitleInput.value.trim();
  if (!title) return alert('Task title is required.');
  const description = addDescInput.value.trim();
  const dueDateTime = addDueInput.value ? new Date(addDueInput.value).toISOString() : null;

  // Load image data if any
  let imageData = null;
  if (addImageInput.files && addImageInput.files[0]) {
    imageData = await readFileAsDataURL(addImageInput.files[0]);
  }

  tasks.push({
    title,
    description,
    due: dueDateTime,
    imageData,
    voiceData: currentVoiceBlob ? URL.createObjectURL(currentVoiceBlob) : null,
  });

  saveTasks();
  renderTasks();
  scheduleNotifications();
  addModal.classList.add('hidden');
  currentVoiceBlob = null;
});

// Save edited task
saveEditBtn.addEventListener('click', async () => {
  if (currentEditId === null) return;

  const title = editTitleInput.value.trim();
  if (!title) return alert('Title cannot be empty');
  const description = editDescInput.value.trim();
  const dueDateTime = editDueInput.value ? new Date(editDueInput.value).toISOString() : null;

  // If new image selected
  let imageData = tasks[currentEditId].imageData || null;
  if (editImageInput.files && editImageInput.files[0]) {
    imageData = await readFileAsDataURL(editImageInput.files[0]);
  }

  // Voice: use new recording if any else keep old
  let voiceData = tasks[currentEditId].voiceData || null;
  if (currentVoiceBlob) {
    voiceData = URL.createObjectURL(currentVoiceBlob);
  }

  tasks[currentEditId] = {
    title,
    description,
    due: dueDateTime,
    imageData,
    voiceData,
  };

  saveTasks();
  renderTasks();
  scheduleNotifications();
  editModal.classList.add('hidden');
  currentEditId = null;
  currentVoiceBlob = null;
});

// Utility: read file as base64 URL
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = e => reject(e);
    reader.readAsDataURL(file);
  });
}

// Image preview
function openImagePreview(src) {
  imagePreviewImg.src = src;
  imagePreviewModal.classList.remove('hidden');
}
closeImagePreviewBtn.addEventListener('click', () => {
  imagePreviewModal.classList.add('hidden');
  imagePreviewImg.src = '';
});

// Voice playback
let audioPlayer = new Audio();
function playVoice(src) {
  if (!src) return;
  audioPlayer.src = src;
  audioPlayer.play();
}

// === Voice Recording Logic ===
function startRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Audio recording is not supported in this browser.');
    return;
  }
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = e => {
      audioChunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      currentVoiceBlob = blob;
      audioPlayback.src = URL.createObjectURL(blob);
      audioPlayback.classList.remove('hidden');
      saveVoiceBtn.disabled = false;
    };

    mediaRecorder.start();
    startRecordingBtn.disabled = true;
    stopRecordingBtn.disabled = false;
    saveVoiceBtn.disabled = true;
    audioPlayback.classList.add('hidden');
  }).catch(err => {
    alert('Could not start audio recording: ' + err);
  });
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    startRecordingBtn.disabled = false;
    stopRecordingBtn.disabled = true;
  }
}

// Open voice record modal for add or edit
function openVoiceRecordModal(isEdit) {
  isRecordingForEdit = isEdit;
  voiceRecordModal.classList.remove('hidden');
  audioPlayback.src = '';
  audioPlayback.classList.add('hidden');
  saveVoiceBtn.disabled = true;
  startRecordingBtn.disabled = false;
  stopRecordingBtn.disabled = true;
  currentVoiceBlob = null;
}

recordVoiceBtn.addEventListener('click', () => openVoiceRecordModal(false));
recordEditVoiceBtn.addEventListener('click', () => openVoiceRecordModal(true));

startRecordingBtn.addEventListener('click', startRecording);
stopRecordingBtn.addEventListener('click', stopRecording);

saveVoiceBtn.addEventListener('click', () => {
  voiceRecordModal.classList.add('hidden');
});

cancelVoiceBtn.addEventListener('click', () => {
  voiceRecordModal.classList.add('hidden');
  currentVoiceBlob = null;
});

// Notifications Setup
function scheduleNotifications() {
  if (!("Notification" in window)) {
    console.log("Notifications not supported.");
    return;
  }
  if (Notification.permission !== "granted") {
    Notification.requestPermission();
  }

  if (window.notificationTimers) {
    window.notificationTimers.forEach(id => clearTimeout(id));
  }
  window.notificationTimers = [];

  const now = new Date();

  tasks.forEach(task => {
    if (task.due) {
      const dueDate = new Date(task.due);
      const diff = dueDate.getTime() - now.getTime();

      if (diff > 0) {
        const timerId = setTimeout(() => {
          new Notification(`Task Reminder: ${task.title}`, {
            body: task.description || 'You have a task due now.',
            icon: 'https://cdn-icons-png.flaticon.com/512/2462/2462719.png',
          });
        }, diff);
        window.notificationTimers.push(timerId);
      }
    }
  });
}

// Initial load and render
loadTasks();
renderTasks();
scheduleNotifications();
