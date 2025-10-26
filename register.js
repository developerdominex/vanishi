const SUPABASE_URL = "https://dfzshvldanqfvfivjrqi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmenNodmxkYW5xZnZmaXZqcnFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4MDIxNTEsImV4cCI6MjA3MDM3ODE1MX0.wdms-6G9eDzRuk1YiCpdyvVS-5CRKCsrq9WWWIFl9HA";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const profilePreview = document.getElementById("profilePreview");
const userAvatar = document.getElementById("userAvatar");
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const continueBtn = document.getElementById("continueBtn");
const messageBox = document.getElementById("messageBox");

const storedProfile = localStorage.getItem("hc_profile");
if (storedProfile) {
  window.location.href = "/";
}

window.onload = () => {
  google.accounts.id.initialize({
    client_id: "549003131640-o9umsg7tu0uisopde76mlf3lg5krt5g7.apps.googleusercontent.com",
    callback: handleCredentialResponse
  });

  google.accounts.id.renderButton(document.getElementById("buttonDiv"), {
    theme: "outline",
    size: "large",
    text: "signin_with",
    shape: "pill"
  });
};

function handleCredentialResponse(response) {
  try {
    const data = JSON.parse(atob(response.credential.split('.')[1]));
    userAvatar.src = data.picture;
    userName.textContent = data.name;
    userEmail.textContent = data.email;

    profilePreview.classList.remove("hidden");

    window.currentProfile = {
      id: data.sub,
      name: data.name,
      email: data.email,
      profile_url: data.picture
    };
  } catch (err) {
    showMessage("Failed to parse Google profile.");
  }
}

continueBtn.onclick = async () => {
  const profile = window.currentProfile;
  if (!profile) return showMessage("No profile data loaded.");

  try {
    const { data: existingUsers, error: selectError } = await supabase
      .from("users")
      .select("*")
      .or(`id.eq.${profile.id},email.eq.${profile.email}`)
      .single();

    if (selectError && selectError.code !== 'PGRST116') throw selectError; 

    if (existingUsers) {
      localStorage.setItem("hc_profile", JSON.stringify(existingUsers));
    } else {
      const { data, error } = await supabase
        .from("users")
        .insert([{
          id: profile.id,
          name: profile.name,
          email: profile.email,
          profile_url: profile.profile_url
        }])
        .select()
        .single();

      if (error) throw error;

      localStorage.setItem("hc_profile", JSON.stringify(data));
    }

    window.location.href = "/";
  } catch (err) {
    showMessage(err.message || "Failed to save user.");
  }
};

function showMessage(msg) {
  messageBox.textContent = msg;
  messageBox.classList.remove("hidden");
}
