const info = document.getElementById('info');
const buttonsDiv = document.querySelector('.button-group');
const startBtn = document.getElementById('startBtn');
const profileData = localStorage.getItem('hc_profile');

if (profileData) {
  const profile = JSON.parse(profileData);
  info.innerHTML = `<i class="fas fa-user-circle"></i> Logged in as <b>${profile.name}</b>`;

  const removeBtn = document.createElement('button');
  removeBtn.id = 'removeBtn';
  removeBtn.innerHTML = '<i class="fas fa-trash"></i> Remove Account';
  buttonsDiv.appendChild(removeBtn);

  removeBtn.addEventListener('click', () => {
    localStorage.removeItem('hc_profile');
    localStorage.removeItem('hc_chat');
    location.reload();
  });

  startBtn.innerHTML = '<i class="fas fa-comments"></i> Continue Chat';
  startBtn.addEventListener('click', () => window.location.href = 'home.html');
} else {
  startBtn.addEventListener('click', () => window.location.href = 'register.html');
}

document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
  if (
    e.key === 'F12' ||
    (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key.toUpperCase())) ||
    (e.ctrlKey && ['U','S','P'].includes(e.key.toUpperCase()))
  ) {
    e.preventDefault();
    e.stopPropagation();
  }
});
