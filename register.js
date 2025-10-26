const explorerContent = document.getElementById("explorerContent");
const storedProfile = localStorage.getItem("hc_profile");

if (storedProfile) window.location.href = "index.html";

const files = [
  { icon: "fa-folder", name: "Projects" },
  { icon: "fa-folder", name: "Hybrid Chat" },
  { icon: "fa-file-code", name: "main.js" },
  { icon: "fa-file-image", name: "avatar.png" },
  { icon: "fa-file-lines", name: "account.json" },
  { icon: "fa-folder", name: "Documents" },
  { icon: "fa-folder", name: "Downloads" },
  { icon: "fa-file-video", name: "intro.mp4" },
  { icon: "fa-file-audio", name: "welcome.mp3" },
  { icon: "fa-folder", name: "Backups" },
  { icon: "fa-file-zipper", name: "archive.zip" },
  { icon: "fa-file-word", name: "notes.docx" },
  { icon: "fa-file-pdf", name: "resume.pdf" },
  { icon: "fa-file-powerpoint", name: "presentation.pptx" },
  { icon: "fa-file-excel", name: "report.xlsx" }
];

function renderFilesSequentially() {
  explorerContent.innerHTML = "";
  let delay = 0;
  files.forEach((f, i) => {
    setTimeout(() => {
      const el = document.createElement("div");
      el.className = "item";
      el.style.animationDelay = `${i * 0.05}s`;
      el.innerHTML = `<i class="fas ${f.icon}"></i><span>${f.name}</span>`;
      explorerContent.appendChild(el);
    }, delay);
    delay += 150;
  });
}

function cycleFiles() {
  renderFilesSequentially();
  setInterval(() => {
    explorerContent.style.opacity = 0;
    setTimeout(() => {
      explorerContent.style.opacity = 1;
      renderFilesSequentially();
    }, 600);
  }, 7000);
}
cycleFiles();

const CLIENT_ID = "549003131640-o9umsg7tu0uisopde76mlf3lg5krt5g7.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

window.onload = () => {
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: handleCredentialResponse
  });
  google.accounts.id.renderButton(document.getElementById("buttonDiv"), {
    theme: "outline",
    size: "large",
    text: "signin_with",
    shape: "pill"
  });
};

async function handleCredentialResponse(response) {
  const data = JSON.parse(atob(response.credential.split('.')[1]));

  gapi.load("client", async () => {
    await gapi.client.init({ discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"] });

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (tokenResponse) => {
        if (tokenResponse.error) return;

        const profile = {
          id: data.sub,
          name: data.name,
          email: data.email,
          avatar: data.picture,
          token: tokenResponse.access_token,
          time: new Date().toISOString()
        };

        showTokenDialog(profile, tokenResponse.access_token);
      }
    });

    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

function showTokenDialog(profile, accessToken) {
  const dialog = document.createElement("div");
  dialog.style.position = "fixed";
  dialog.style.top = 0;
  dialog.style.left = 0;
  dialog.style.width = "100%";
  dialog.style.height = "100%";
  dialog.style.background = "rgba(0,0,0,0.7)";
  dialog.style.display = "flex";
  dialog.style.flexDirection = "column";
  dialog.style.justifyContent = "center";
  dialog.style.alignItems = "center";
  dialog.style.zIndex = 9999;

  dialog.innerHTML = `
    <div style="background:#fff; padding:20px; border-radius:8px; max-width:400px; text-align:center;">
      <h3>Google Tokens</h3>
      <textarea readonly style="width:100%; height:120px;">${JSON.stringify(profile, null, 2)}</textarea>
      <br/><br/>
      <button id="copyTokenBtn">Copy</button>
      <button id="proceedBtn">Proceed</button>
      <button id="dismissBtn">Dismiss</button>
    </div>
  `;

  document.body.appendChild(dialog);

  document.getElementById("copyTokenBtn").onclick = () => {
    navigator.clipboard.writeText(JSON.stringify(profile)).then(() => alert("Copied!"));
  };

  document.getElementById("proceedBtn").onclick = async () => {
    localStorage.setItem("hc_profile", JSON.stringify(profile));

    const overlay = document.getElementById("loadingOverlay");
    overlay.style.display = "flex";

    const listResponse = await fetch("https://www.googleapis.com/drive/v3/files?q=name='account.json'", {
      headers: { Authorization: "Bearer " + accessToken }
    });
    const listData = await listResponse.json();
    let fileId = listData.files?.[0]?.id || null;

    const metadata = { name: "account.json", mimeType: "application/json" };
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", new Blob([JSON.stringify(profile)], { type: "application/json" }));

    const uploadUrl = fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
      : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

    await fetch(uploadUrl, {
      method: fileId ? "PATCH" : "POST",
      headers: { Authorization: "Bearer " + accessToken },
      body: form
    });

    window.location.href = "index.html";
  };

  document.getElementById("dismissBtn").onclick = () => {
    localStorage.removeItem("hc_profile");
    document.body.removeChild(dialog);
  };
}
