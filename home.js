import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://dfzshvldanqfvfivjrqi.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmenNodmxkYW5xZnZmaXZqcnFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4MDIxNTEsImV4cCI6MjA3MDM3ODE1MX0.wdms-6G9eDzRuk1YiCpdyvVS-5CRKCsrq9WWWIFl9HA'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const DRIVE_FILE_NAME = 'chat.json'
const STORAGE_KEY = 'hc_profile'
const profile = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
if (!profile) { location.href = 'register.html'; throw new Error('No profile') }

const MY_ID = profile.id
const MY_NAME = profile.name
const MY_AVATAR = profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}`
const DRIVE_TOKEN = profile.token

const contactsEl = document.getElementById('contacts')
const searchEl = document.getElementById('search')
const addBtn = document.getElementById('addBtn')
const logoutBtn = document.getElementById('logout')
const peerAvatarEl = document.getElementById('peerAvatar')
const peerNameEl = document.getElementById('peerName')
const peerStatusEl = document.getElementById('peerStatus')
const placeholderEl = document.getElementById('placeholder')
const messagesEl = document.getElementById('messages')
const messageInput = document.getElementById('messageInput')
const sendBtn = document.getElementById('sendBtn')
const attachBtn = document.getElementById('attach')
document.getElementById('myAvatar').src = MY_AVATAR
document.getElementById('myName').textContent = MY_NAME
const videoCallBtn = document.getElementById('videoCallBtn');
const audioCallBtn = document.getElementById('audioCallBtn');

videoCallBtn.onclick = () => {
  if (!currentPeer) return alert('Select a contact first.');
  startCall(currentPeer, true); // video call
}

audioCallBtn.onclick = () => {
  if (!currentPeer) return alert('Select a contact first.');
  startCall(currentPeer, false); // audio only call
}

let chatStore = {}
let online = {}
let currentPeer = null
let DRIVE_FILE_ID = null
let typingTimeout = {}
let pcMap = {}, dcMap = {}
const typingIndicators = {}


function showTyping(peerId) {
  if (typingIndicators[peerId]) return;
  const name = chatStore[peerId]?.profile?.name || 'User';
  const d = document.createElement('div');
  d.className = 'typing-indicator';
  d.id = `typing-${peerId}`;
  d.innerHTML = `<span class="label">${name} is typing</span>
    <div class="typing-dots"><span></span><span></span><span></span></div>`;
  messagesEl.appendChild(d);
  typingIndicators[peerId] = d;
  requestAnimationFrame(() => scrollElementIntoView(d, true));
}
function hideTyping(peerId) {
  const el = typingIndicators[peerId];
  if (!el) return;
  el.style.transition = 'opacity .18s ease, transform .18s ease';
  el.style.opacity = '0';
  el.style.transform = 'translateY(8px)';
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 200);
  delete typingIndicators[peerId];
}

// ---- UI: Contacts ----
function renderContacts(filter = '') {
  contactsEl.innerHTML = ''
 
  const sorted = Object.values(chatStore)
  .filter(c => c.messages && c.messages.length > 0)
  .sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0))
  .filter(c => !filter || c.profile.name.toLowerCase().includes(filter.toLowerCase()));
 if (sorted.length === 0) {
  contactsEl.innerHTML = `<div style="text-align:center;color:#64748b;padding:20px">No chats yet</div>`;
  return;
}
  for (const c of sorted) {
    const u = c.profile
    const lastMsg = c.messages.slice(-1)[0]
    const unread = c.unreadCount > 0
    const div = document.createElement('div')
    div.className = 'contact' + (currentPeer === u.uuid ? ' selected' : '')
    div.innerHTML = `
      <img class="avatar" src="${u.avatar}">
      <div class="meta">
        <div class="name" style="font-weight:${unread ? '700' : '500'}">${u.name}</div>
        <div class="last">${lastMsg ? (lastMsg.isImage ? '📷 Image' : lastMsg.text) : 'No messages yet'}</div>
      </div>`
    div.onclick = () => openChat(u.uuid)
    contactsEl.appendChild(div)
  }
}
const callDialog = document.getElementById('callDialog');
const callPeerName = document.getElementById('callPeerName');
const callPeerAvatar = document.getElementById('callPeerAvatar');
const remoteVideo = document.getElementById('remoteVideo');
const localVideo = document.getElementById('localVideo');
const incomingActions = document.getElementById('incomingActions');
const acceptCallBtn = document.getElementById('acceptCallBtn');
const declineCallBtn = document.getElementById('declineCallBtn');
const callActions = callDialog.querySelector('.call-actions');
const muteBtn = document.getElementById('muteBtn');
const cameraBtn = document.getElementById('cameraBtn');
const switchBtn = document.getElementById('switchBtn');
const hangupBtn = document.getElementById('hangupBtn');
const callCloseBtn = document.getElementById('callCloseBtn');

let callPC = null, localStream = null;
let currentCallPeer = null, isCalling = false;
const STUN_CONFIG = { iceServers:[{urls:'stun:stun.l.google.com:19302'}] };

// --- Outgoing Call ---
async function startCall(peerId, isVideo=true){
  if(isCalling){ alert('You are already in a call.'); return; }
  if(online[peerId]===false){ alert('The person is offline.'); return; }
  currentCallPeer = peerId; isCalling=true;

  callPC = new RTCPeerConnection(STUN_CONFIG);
  callPC.onicecandidate = e=>{ if(e.candidate) sendSignal(peerId,{type:'candidate',candidate:e.candidate}); };
  callPC.ontrack = e=>{ remoteVideo.srcObject = e.streams[0]; };

  localStream = await navigator.mediaDevices.getUserMedia({video:isVideo,audio:true});
  localStream.getTracks().forEach(track=>callPC.addTrack(track,localStream));
  localVideo.srcObject = localStream;

  const offer = await callPC.createOffer();
  await callPC.setLocalDescription(offer);
  sendSignal(peerId,{type:'call-offer',sdp:offer,video:isVideo});

  showCallDialog(peerId,true,false);
}

// --- Incoming Call ---
async function handleCallOffer(from,sdp,isVideo){
  if(isCalling){ sendSignal(from,{type:'busy'}); return; }
  currentCallPeer = from; isCalling=true;

  callPC = new RTCPeerConnection(STUN_CONFIG);
  callPC.onicecandidate = e => {
  if (e.candidate)
    sendSignal(currentCallPeer, { type: 'candidate', candidate: e.candidate, isCall: true });
};

  callPC.ontrack = e=>{ remoteVideo.srcObject = e.streams[0]; };

  localStream = await navigator.mediaDevices.getUserMedia({video:isVideo,audio:true});
  localStream.getTracks().forEach(track=>callPC.addTrack(track,localStream));
  localVideo.srcObject = localStream;

  callPC.remoteSDP = sdp; // save to answer later
  showCallDialog(from,false,true); // show incoming actions
}

acceptCallBtn.onclick = async ()=>{
  callActions.style.display = 'flex';
  incomingActions.style.display = 'none';

  await callPC.setRemoteDescription(new RTCSessionDescription(callPC.remoteSDP));
  const answer = await callPC.createAnswer();
  await callPC.setLocalDescription(answer);
  sendSignal(currentCallPeer,{type:'call-answer',sdp:answer});
}

declineCallBtn.onclick = ()=>{
  sendSignal(currentCallPeer,{type:'decline'});
  endCall();
}

async function handleCallAnswer(from,sdp){ await callPC.setRemoteDescription(new RTCSessionDescription(sdp)); }

function handleBusy(){ alert('The person you are calling is busy.'); endCall(); }
function handleDecline(){ alert('Call declined.'); endCall(); }


function endCall(){
  if(callPC) callPC.close();
  if(localStream) localStream.getTracks().forEach(t=>t.stop());
  callPC=null; localStream=null; isCalling=false; currentCallPeer=null;
  callDialog.style.display='none';
}

  
function showCallDialog(peerId,isOutgoing=false,isIncoming=false){
  callDialog.style.display='flex';
  
  const peer = chatStore[peerId]?.profile || { name: 'User', avatar: `https://ui-avatars.com/api/?name=User` };
  
  callPeerAvatar.src = peer.avatar;
  callPeerAvatar.style.width = '60px';
  callPeerAvatar.style.height = '60px';
  callPeerAvatar.style.borderRadius = '50%';
  callPeerAvatar.style.border = '3px solid #10b981';
  callPeerAvatar.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
  callPeerAvatar.style.objectFit = 'cover';
  callPeerAvatar.style.transition = 'all 0.3s ease';
  
  callPeerName.textContent = peer.name;
  callPeerName.style.fontSize = '18px';
  callPeerName.style.fontWeight = '700';
  callPeerName.style.color = '#111827';
  callPeerName.style.marginLeft = '12px';
  callPeerName.style.transition = 'all 0.3s ease';

  const parent = callPeerName.parentElement;
  parent.style.display = 'flex';
  parent.style.alignItems = 'center';
  parent.style.padding = '12px 20px';
  parent.style.background = 'linear-gradient(135deg, #f3f4f6, #e5e7eb)';
  parent.style.borderRadius = '15px';
  parent.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
  
  callActions.style.display = isOutgoing ? 'flex' : 'none';
  incomingActions.style.display = isIncoming ? 'flex' : 'none';
}

  
hangupBtn.onclick = callCloseBtn.onclick = endCall;
muteBtn.onclick = ()=>{ localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled; }
cameraBtn.onclick = ()=>{ localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled; }
switchBtn.onclick = async ()=>{
  const videoTrack = localStream.getVideoTracks()[0];
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter(d=>d.kind==='videoinput');
  if(cameras.length<2) return;
  const newDevice = cameras.find(d=>d.deviceId!==videoTrack.getSettings().deviceId);
  const newStream = await navigator.mediaDevices.getUserMedia({video:{deviceId:newDevice.deviceId},audio:false});
  const sender = callPC.getSenders().find(s=>s.track.kind==='video');
  sender.replaceTrack(newStream.getVideoTracks()[0]);
  localStream.removeTrack(videoTrack); localStream.addTrack(newStream.getVideoTracks()[0]);
  localVideo.srcObject = localStream;
}
function openChat(peerId) {
  currentPeer = peerId
  const peer = chatStore[peerId].profile
  chatStore[peerId].unreadCount = 0
  peerNameEl.textContent = peer.name
  peerAvatarEl.src = peer.avatar
  peerAvatarEl.style.display = 'block'
  updatePeerStatus(peerId)
  document.getElementById('chatActions').style.display = 'flex';

  placeholderEl.style.display = 'none'
  messagesEl.style.display = 'flex'
  messagesEl.innerHTML = ''

  for (const msg of chatStore[peerId].messages)
    renderMessage(msg.text, msg.me, msg.isImage, false)

  if (!pcMap[peerId]) createConnection(peerId)
  saveToDrive()
  renderContacts()
  scrollBottom()
}

function renderMessage(text, me, isImage, animate = true) {
  const d = document.createElement('div');
  d.className = 'msg ' + (me ? 'me' : 'other');
  if (isImage) {
    const img = document.createElement('img');
    img.src = text;
    img.alt = 'Image message';
    img.style.opacity = '0';
    img.style.transition = 'opacity .25s ease';
    d.appendChild(img);
    messagesEl.appendChild(d);
    img.onload = () => {
      img.style.opacity = '1';
      requestAnimationFrame(() => scrollElementIntoView(d, true));
    };
    img.onerror = () => {
      img.style.opacity = '1';
      requestAnimationFrame(() => scrollElementIntoView(d, true));
    };
  } else {
    d.textContent = text;
    messagesEl.appendChild(d);
    if (animate) { d.style.opacity = 0; requestAnimationFrame(() => d.style.opacity = 1); }
    requestAnimationFrame(() => scrollElementIntoView(d, true));
  }
}
function scrollElementIntoView(el, smooth = true) {
  try {
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end', inline: 'nearest' });
  } catch {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}
  function resetChatView() {
  placeholderEl.style.display = 'flex';
  messagesEl.style.display = 'none';
  document.getElementById('chatActions').style.display = 'none';
}
resetChatView();

function scrollBottom(smooth = true) {
  const last = messagesEl.lastElementChild;
  if (last) scrollElementIntoView(last, smooth);
  else messagesEl.scrollTop = messagesEl.scrollHeight;
}
function sendMessage() {
  if (!currentPeer) return
  const val = messageInput.value.trim()
  if (!val) return
  const ts = Date.now()
  const msg = { id: ts + '-me', text: val, ts, me: true, isImage: false }
  chatStore[currentPeer].messages.push(msg)
  chatStore[currentPeer].lastTs = ts
  renderMessage(val, true, false)
  messageInput.value = ''

  const payload = { text: val, ts, id: msg.id, isImage: false }
  if (dcMap[currentPeer]?.readyState === 'open')
    dcMap[currentPeer].send(JSON.stringify(payload))
  else
    sendSignal(currentPeer, { type: 'message', data: val, ts, id: msg.id, isImage: false })

  saveToDrive()
  renderContacts()
}

function appendIncoming(from, text, isImage, ts, id) {
  hideTyping(from)
  const chat = chatStore[from] || (chatStore[from] = { profile: { uuid: from, name: 'User', avatar: `https://ui-avatars.com/api/?name=User` }, messages: [], unreadCount: 0 })
  if (chat.messages.some(m => m.id === id)) return
  chat.messages.push({ id, text, me: false, isImage, ts })
  chat.lastTs = ts
  if (currentPeer === from) renderMessage(text, false, isImage)
  else chat.unreadCount++
  renderContacts()
  saveToDrive()
}
attachBtn.onclick = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    const dataUrl = await resizeAndCompress(f, 200, 200, 0.3, 25); // target 25KB
    sendImageMessage(dataUrl);
  };
  input.click();
};

async function resizeAndCompress(file, maxWidth, maxHeight, initialQuality = 0.3, targetKB = 25) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => img.src = e.target.result;
    img.onload = () => {
      let { width, height } = img;

      // maintain aspect ratio
      const scale = Math.min(maxWidth / width, maxHeight / height, 1);
      width = width * scale;
      height = height * scale;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      let quality = initialQuality;
      let compressed = canvas.toDataURL('image/jpeg', quality);
      let sizeKB = Math.round((compressed.length * 3 / 4) / 1024);

      // reduce quality in small steps until < targetKB
      while (sizeKB > targetKB && quality > 0.05) {
        quality -= 0.05;
        compressed = canvas.toDataURL('image/jpeg', quality);
        sizeKB = Math.round((compressed.length * 3 / 4) / 1024);
      }

      resolve(compressed);
    };
    reader.readAsDataURL(file);
  });
}



function sendImageMessage(dataUrl) {
  if (!currentPeer) return
  const ts = Date.now()
  const msg = { id: ts + '-me', text: dataUrl, ts, me: true, isImage: true }
  chatStore[currentPeer].messages.push(msg)
  chatStore[currentPeer].lastTs = ts
  renderMessage(dataUrl, true, true)

  const payload = { text: dataUrl, ts, id: msg.id, isImage: true }
  if (dcMap[currentPeer]?.readyState === 'open')
    dcMap[currentPeer].send(JSON.stringify(payload))
  else sendSignal(currentPeer, { type: 'message', data: dataUrl, ts, id: msg.id, isImage: true })

  saveToDrive()
  renderContacts()
}

// ---- Supabase Presence & Signaling ----
async function startRealtime() {
  const presence = supabase.channel('presence')
  const signaling = supabase.channel('signaling')

  presence.on('broadcast', { event: 'presence' }, ({ payload }) => {
    if (!payload?.uuid) return
    if (payload.action === 'join' || payload.action === 'update') {
      online[payload.uuid] = true
      chatStore[payload.uuid] = chatStore[payload.uuid] || { profile: payload, messages: [], unreadCount: 0 }
    } else if (payload.action === 'leave') {
      online[payload.uuid] = false
      chatStore[payload.uuid].lastSeen = Date.now()
    }
    renderContacts()
    if (payload.uuid === currentPeer) updatePeerStatus(currentPeer)
  })

 signaling.on('broadcast', { event: 'signal' }, async ({ payload }) => {
  if (!payload || payload.to !== MY_ID) return;

  switch(payload.type) {
    case 'offer': await handleOffer(payload.from, payload.sdp); break;
    case 'answer': await handleAnswer(payload.from, payload.sdp); break;
    case 'candidate': 
      await handleCandidate(payload.from, payload.candidate, !!payload.isCall); 
      break;

    case 'call-offer': handleCallOffer(payload.from, payload.sdp, payload.video); break;
    case 'call-answer': handleCallAnswer(payload.from, payload.sdp); break;
    case 'busy': handleBusy(); break;
    case 'decline': handleDecline(); break;

    case 'message': appendIncoming(payload.from, payload.data, payload.isImage, payload.ts, payload.id); break;
    case 'typing': if (payload.from === currentPeer) showTyping(payload.from); break;
    case 'stopTyping': hideTyping(payload.from); break;
  }
});


  await presence.subscribe()
  await signaling.subscribe()
  setInterval(() => sendPresence('update'), 25000)
  window.addEventListener('beforeunload', () => sendPresence('leave'))
  sendPresence('join')

  await fetchDriveData()
}

function sendPresence(action) {
  supabase.channel('presence').send({
    type: 'broadcast', event: 'presence',
    payload: { uuid: MY_ID, name: MY_NAME, avatar: MY_AVATAR, action, ts: Date.now() }
  })
}
function sendSignal(to, msg) {
  supabase.channel('signaling').send({
    type: 'broadcast', event: 'signal', payload: { ...msg, from: MY_ID, to }
  })
}

// ---- WebRTC ----
function createConnection(peer) {
  const pc = new RTCPeerConnection()
  const dc = pc.createDataChannel('chat')
  dc.onmessage = ev => {
    const d = JSON.parse(ev.data)
    appendIncoming(peer, d.text, d.isImage, d.ts, d.id)
  }
  dc.onopen = () => (dcMap[peer] = dc)
  pc.onicecandidate = e => {
  if (e.candidate)
    sendSignal(peer, { type: 'candidate', candidate: e.candidate, isCall: false });
};

  pcMap[peer] = pc
  makeOffer(peer)
}
async function makeOffer(peer) {
  const pc = pcMap[peer]
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  sendSignal(peer, { type: 'offer', sdp: offer })
}
async function handleOffer(from, sdp) {
  const pc = new RTCPeerConnection()
  pc.ondatachannel = e => {
    const ch = e.channel
    ch.onmessage = ev => {
      const d = JSON.parse(ev.data)
      appendIncoming(from, d.text, d.isImage, d.ts, d.id)
    }
    ch.onopen = () => (dcMap[from] = ch)
  }
  pc.onicecandidate = e => e.candidate && sendSignal(from, { type: 'candidate', candidate: e.candidate })
  pcMap[from] = pc
  await pc.setRemoteDescription(new RTCSessionDescription(sdp))
  const answer = await pc.createAnswer()
  await pc.setLocalDescription(answer)
  sendSignal(from, { type: 'answer', sdp: answer })
}
async function handleAnswer(from, sdp) {
  await pcMap[from]?.setRemoteDescription(new RTCSessionDescription(sdp))
}
async function handleCandidate(from, candidate, isCall=false) {
  try {
    if (isCall) {
      if (callPC) await callPC.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      if (pcMap[from]) await pcMap[from].addIceCandidate(new RTCIceCandidate(candidate));
    }
  } catch (err) {
    console.warn('Failed to add ICE candidate', err);
  }
}


// ---- Drive Persistence ----
async function fetchDriveData() {
  try {
    const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${DRIVE_FILE_NAME}' and trashed=false&fields=files(id,name)`, {
      headers: { Authorization: 'Bearer ' + DRIVE_TOKEN }
    })
    const list = await listRes.json()
    DRIVE_FILE_ID = list.files?.[0]?.id
    if (DRIVE_FILE_ID) {
      const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${DRIVE_FILE_ID}?alt=media`, {
        headers: { Authorization: 'Bearer ' + DRIVE_TOKEN }
      })
      if (fileRes.ok) {
        chatStore = await fileRes.json()
        renderContacts()
      }
    } else saveToDrive()
  } catch (e) { logout() }
}
async function saveToDrive() {
  try {
    const meta = { name: DRIVE_FILE_NAME, mimeType: 'application/json' }
    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }))
    form.append('file', new Blob([JSON.stringify(chatStore)], { type: 'application/json' }))
    const url = DRIVE_FILE_ID
      ? `https://www.googleapis.com/upload/drive/v3/files/${DRIVE_FILE_ID}?uploadType=multipart`
      : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`
    const res = await fetch(url, { method: DRIVE_FILE_ID ? 'PATCH' : 'POST', headers: { Authorization: 'Bearer ' + DRIVE_TOKEN }, body: form })
    if (res.ok) DRIVE_FILE_ID = (await res.json()).id
  } catch { logout() }
}
function logout() { localStorage.removeItem(STORAGE_KEY); location.href = 'register.html' }

// ---- Status Updates ----
function updatePeerStatus(id) {
  peerStatusEl.textContent = online[id] ? 'Online' :
    chatStore[id]?.lastSeen ? 'Last seen at ' + new Date(chatStore[id].lastSeen).toLocaleTimeString() : 'Offline'
}

// ---- Init ----
searchEl.oninput = () => renderContacts(searchEl.value.trim())
addBtn.onclick = () => {
  renderOnlineDialog();
};

logoutBtn.onclick = logout
sendBtn.onclick = sendMessage
messageInput.onkeydown = e => {
  if (!currentPeer) return
  if (e.key === 'Enter') sendMessage()
  else sendTypingSignal()
}
function renderOnlineDialog() {
  const dialog = document.getElementById('onlineDialog');
  const list = document.getElementById('onlineList');
  const closeBtn = document.getElementById('closeDialog');
  list.innerHTML = '';

  const onlineUsers = Object.values(chatStore)
    .map(c => c.profile)
    .filter(p => online[p.uuid] && p.uuid !== MY_ID);

  if (onlineUsers.length === 0) {
    list.innerHTML = `<div style="text-align:center;color:#64748b;padding:20px">No one online</div>`;
  } else {
    for (const u of onlineUsers) {
      const div = document.createElement('div');
      div.className = 'dialog-user';
      div.innerHTML = `
        <img src="${u.avatar}">
        <span>${u.name}</span>
      `;
      div.onclick = () => {
        dialog.style.display = 'none';
        if (!chatStore[u.uuid])
          chatStore[u.uuid] = { profile: u, messages: [], unreadCount: 0 };
        openChat(u.uuid);
      };
      list.appendChild(div);
    }
  }

  dialog.style.display = 'flex';
  closeBtn.onclick = () => dialog.style.display = 'none';
}

function sendTypingSignal() {
  if (!currentPeer) return
  clearTimeout(typingTimeout[currentPeer])
  sendSignal(currentPeer, { type: 'typing' })
  typingTimeout[currentPeer] = setTimeout(() => {
    sendSignal(currentPeer, { type: 'stopTyping' })
  }, 3000)
}

startRealtime() 
