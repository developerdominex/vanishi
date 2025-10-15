const fileInput = document.getElementById('fileInput');
const chatContainer = document.getElementById('chatContainer');

fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = event => {
    try {
      const jsonData = JSON.parse(event.target.result);
      renderChats(jsonData);
    } catch {
      alert("Invalid JSON format. Please upload a valid chat.json file.");
    }
  };
  reader.readAsText(file);
});

function renderChats(data) {
  chatContainer.classList.remove('empty');
  chatContainer.innerHTML = '';

  Object.keys(data).forEach((uid, index) => {
    const userData = data[uid];
    const profile = userData.profile;
    const messages = userData.messages;

    const partition = document.createElement('div');
    partition.className = 'chat-partition';
    partition.style.animationDelay = `${index * 0.05}s`;
    partition.innerHTML = `
      <div class="chat-header">
        <img src="${profile.avatar}" alt="${profile.name}">
        <h2>${profile.name}</h2>
      </div>
      <div class="messages"></div>
    `;

    const messagesDiv = partition.querySelector('.messages');
    messages.forEach(msg => {
      const msgDiv = document.createElement('div');
      msgDiv.className = `message ${msg.me ? 'me' : 'other'}`;
      if (msg.isImage) {
        const img = document.createElement('img');
        img.src = msg.text;
        img.alt = "Image message";
        msgDiv.appendChild(img);
      } else {
        msgDiv.textContent = msg.text;
      }
      messagesDiv.appendChild(msgDiv);
    });

    chatContainer.appendChild(partition);
  });

  setTimeout(() => {
    chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
  }, 300);
}
