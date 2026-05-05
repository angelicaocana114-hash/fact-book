const SUPABASE_URL = "https://shbkmjnlluyozfyuooas.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_n5FhzL7k3mh1FSBKFnquFQ_2a_resGl";
const POST_ID = "english-claim-1";

const authScreen = document.getElementById("authScreen");
const feedScreen = document.getElementById("feedScreen");
const loginForm = document.getElementById("loginForm");
const studentName = document.getElementById("studentName");
const studentPassword = document.getElementById("studentPassword");
const studentPhoto = document.getElementById("studentPhoto");
const photoPreview = document.getElementById("photoPreview");
const topbarAvatar = document.getElementById("topbarAvatar");
const composerAvatar = document.getElementById("composerAvatar");
const topbarName = document.getElementById("topbarName");
const logoutButton = document.getElementById("logoutButton");
const reactButton = document.getElementById("reactButton");
const reactWrap = document.querySelector(".react-wrap");
const reactionPicker = document.getElementById("reactionPicker");
const currentReactionIcon = document.getElementById("currentReactionIcon");
const currentReactionLabel = document.getElementById("currentReactionLabel");
const reactionIconsStack = document.getElementById("reactionIconsStack");
const reactionCountButton = document.getElementById("reactionCountButton");
const commentCount = document.getElementById("commentCount");
const commentFocusButton = document.getElementById("commentFocusButton");
const shareButton = document.getElementById("shareButton");
const commentForm = document.getElementById("commentForm");
const commentInput = document.getElementById("commentInput");
const commentList = document.getElementById("commentList");
const commentTemplate = document.getElementById("commentTemplate");
const reactionModal = document.getElementById("reactionModal");
const reactionModalBackdrop = document.getElementById("reactionModalBackdrop");
const reactionModalClose = document.getElementById("reactionModalClose");
const reactionModalList = document.getElementById("reactionModalList");
const reactionFilterRow = document.getElementById("reactionFilterRow");

const reactionMeta = {
  Like: { emoji: "👍", color: "#1877f2", className: "like" },
  Love: { emoji: "❤️", color: "#f33e58", className: "love" },
  Care: { emoji: "🤗", color: "#f7b125", className: "wow" },
  Haha: { emoji: "😂", color: "#f7b125", className: "wow" },
  Wow: { emoji: "😮", color: "#f7b125", className: "wow" },
  Sad: { emoji: "😢", color: "#f7b125", className: "wow" },
  Angry: { emoji: "😡", color: "#e4602a", className: "love" }
};

const state = {
  user: null,
  comments: [],
  reactions: {},
  selectedReaction: null,
  reactionPeople: [],
  activeReactionFilter: "All",
  refreshTimer: null
};

const fallbackStore = {
  comments: [],
  reactionsByUser: {}
};

window.addEventListener("load", () => {
  resetToLogin();
});

studentPhoto.addEventListener("change", () => {
  const [file] = studentPhoto.files;
  if (!file) {
    photoPreview.innerHTML = "<span>No photo selected</span>";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    photoPreview.innerHTML = `<img src="${reader.result}" alt="Selected profile preview">`;
  };
  reader.readAsDataURL(file);
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = studentName.value.trim();
  const password = studentPassword.value.trim();
  const [file] = studentPhoto.files;

  if (!name || !password || !file) {
    return;
  }

  const avatar = await readFileAsDataUrl(file);
  state.user = {
    id: createId(),
    name,
    avatar
  };

  clearLoginForm();
  showFeed();
  await ensureProfile().catch(() => {});
  await refreshFeed().catch(() => {
    applyFallbackToState();
    renderReactionState();
    renderComments();
    renderReactionModal();
  });
});

logoutButton.addEventListener("click", () => {
  resetToLogin();
});

reactButton.addEventListener("click", () => {
  if (!state.user) {
    return;
  }
  reactWrap.classList.toggle("open");
});

reactionPicker.querySelectorAll(".picker-react").forEach((button) => {
  button.addEventListener("click", async () => {
    if (!state.user) {
      return;
    }

    const reaction = button.dataset.reaction;
    let usedFallback = false;

    try {
      await ensureProfile();
      if (state.selectedReaction === reaction) {
        await deleteReaction();
      } else {
        await upsertReaction(reaction);
      }
      await refreshFeed();
    } catch {
      usedFallback = true;
      toggleFallbackReaction(reaction);
    }

    reactWrap.classList.remove("open");
    spawnReactionBurst(reactionMeta[reaction].emoji);

    if (!usedFallback) {
      renderReactionState();
      renderReactionModal();
    }
  });
});

document.addEventListener("click", (event) => {
  if (!reactWrap.contains(event.target)) {
    reactWrap.classList.remove("open");
  }
});

commentFocusButton.addEventListener("click", () => {
  commentInput.focus();
});

commentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.user) {
    return;
  }

  const text = commentInput.value.trim();
  if (!text) {
    return;
  }

  try {
    await ensureProfile();
    await createComment(text);
    commentInput.value = "";
    await refreshFeed();
  } catch {
    addFallbackComment(text);
    commentInput.value = "";
  }
});

shareButton.addEventListener("click", async () => {
  const shareUrl = window.location.href;
  const shareText = "Join the discussion on Fact-Book.";

  try {
    if (navigator.share) {
      await navigator.share({ title: "Fact-Book", text: shareText, url: shareUrl });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareUrl);
    } else {
      copyWithTextarea(shareUrl);
    }
    pulseShareButton("Shared");
  } catch {
    pulseShareButton("Share");
  }
});

reactionCountButton.addEventListener("click", () => {
  renderReactionModal();
  reactionModal.classList.remove("hidden");
});

reactionModalClose.addEventListener("click", closeReactionModal);
reactionModalBackdrop.addEventListener("click", closeReactionModal);

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeReactionModal();
  }
});

async function refreshFeed() {
  const [comments, reactions, reactionPeople, ownReaction] = await Promise.all([
    listComments(),
    listReactions(),
    listReactionPeople(),
    getOwnReaction()
  ]);

  state.comments = comments;
  state.reactions = reactions;
  state.reactionPeople = reactionPeople;
  state.selectedReaction = ownReaction;

  renderReactionState();
  renderComments();
  renderReactionModal();
}

function showFeed() {
  authScreen.classList.add("hidden");
  feedScreen.classList.remove("hidden");
  document.body.classList.add("feed-mode");
  topbarAvatar.src = state.user.avatar;
  composerAvatar.src = state.user.avatar;
  topbarName.textContent = state.user.name;
  forceScrollTop();

  if (!state.refreshTimer) {
    state.refreshTimer = window.setInterval(() => {
      refreshFeed().catch(() => {
        applyFallbackToState();
        renderReactionState();
        renderComments();
        renderReactionModal();
      });
    }, 4000);
  }
}

function resetToLogin() {
  state.user = null;
  state.comments = [];
  state.reactions = {};
  state.selectedReaction = null;
  state.reactionPeople = [];
  state.activeReactionFilter = "All";

  if (state.refreshTimer) {
    window.clearInterval(state.refreshTimer);
    state.refreshTimer = null;
  }

  feedScreen.classList.add("hidden");
  authScreen.classList.remove("hidden");
  document.body.classList.remove("feed-mode");
  closeReactionModal();
  clearLoginForm();
  reactWrap.classList.remove("open");
  topbarAvatar.removeAttribute("src");
  composerAvatar.removeAttribute("src");
  topbarName.textContent = "";
  applyFallbackToState();
  renderReactionState();
  renderComments();
  forceScrollTop();
}

function renderReactionState() {
  const totals = Object.entries(state.reactions).sort((a, b) => b[1] - a[1]);
  const totalCount = totals.reduce((sum, entry) => sum + entry[1], 0);

  reactionIconsStack.innerHTML = "";
  if (!totals.length) {
    ["Like", "Love", "Wow"].forEach((name) => {
      const icon = document.createElement("span");
      icon.className = `mini-react ${reactionMeta[name].className}`;
      icon.textContent = reactionMeta[name].emoji;
      reactionIconsStack.appendChild(icon);
    });
  } else {
    totals.slice(0, 3).forEach(([name]) => {
      const icon = document.createElement("span");
      icon.className = `mini-react ${reactionMeta[name].className}`;
      icon.textContent = reactionMeta[name].emoji;
      reactionIconsStack.appendChild(icon);
    });
  }

  reactionCountButton.textContent = `${totalCount} reaction${totalCount === 1 ? "" : "s"}`;
  commentCount.textContent = `${state.comments.length} comment${state.comments.length === 1 ? "" : "s"}`;

  if (!state.selectedReaction) {
    currentReactionIcon.textContent = "👍";
    currentReactionLabel.textContent = "Like";
    reactButton.style.color = "#596679";
    return;
  }

  currentReactionIcon.textContent = reactionMeta[state.selectedReaction].emoji;
  currentReactionLabel.textContent = state.selectedReaction;
  reactButton.style.color = reactionMeta[state.selectedReaction].color;
}

function renderComments() {
  commentList.innerHTML = "";

  if (!state.comments.length) {
    commentList.innerHTML = `
      <article class="comment-item">
        <div class="comment-main">
          <div class="comment-placeholder-icon">💬</div>
          <div class="comment-bubble">
            <strong class="comment-author">Start the discussion</strong>
            <p>Share your thoughts about the post.</p>
          </div>
        </div>
      </article>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();
  state.comments.forEach((comment) => {
    const isOwner = state.user && comment.profile_id === state.user.id;

    if (isOwner) {
      const article = document.createElement("article");
      article.className = "comment-item owned";
      article.innerHTML = `
        <div class="comment-main">
          <img class="comment-avatar" alt="Comment avatar" src="${escapeHtml(comment.avatar_data_url)}">
          <div class="comment-bubble">
            <strong class="comment-author">${escapeHtml(comment.display_name)}</strong>
            <p class="comment-text">${escapeHtml(comment.body_text)}</p>
          </div>
        </div>
        <button type="button" class="comment-delete-btn">Delete</button>
      `;
      article.querySelector(".comment-delete-btn").addEventListener("click", async () => {
        try {
          await deleteComment(comment.id);
          await refreshFeed();
        } catch {
          deleteFallbackComment(comment.id);
        }
      });
      fragment.appendChild(article);
      return;
    }

    const node = commentTemplate.content.cloneNode(true);
    node.querySelector(".comment-avatar").src = comment.avatar_data_url;
    node.querySelector(".comment-author").textContent = comment.display_name;
    node.querySelector(".comment-text").textContent = comment.body_text;
    fragment.appendChild(node);
  });

  commentList.appendChild(fragment);
}

function renderReactionModal() {
  const filters = [
    { name: "All", count: state.reactionPeople.length, label: "All" },
    ...Object.entries(state.reactions)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        label: `${reactionMeta[name].emoji} ${count}`
      }))
  ];

  reactionFilterRow.innerHTML = "";
  filters.forEach((filter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `reaction-filter-btn${state.activeReactionFilter === filter.name ? " active" : ""}`;
    button.textContent = filter.label;
    button.addEventListener("click", () => {
      state.activeReactionFilter = filter.name;
      renderReactionModal();
    });
    reactionFilterRow.appendChild(button);
  });

  const visible = state.activeReactionFilter === "All"
    ? state.reactionPeople
    : state.reactionPeople.filter((entry) => entry.reaction_name === state.activeReactionFilter);

  reactionModalList.innerHTML = "";
  if (!visible.length) {
    reactionModalList.innerHTML = `<div class="reaction-empty">No reactions to show yet.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  visible.forEach((entry) => {
    const row = document.createElement("article");
    row.className = "reaction-person";
    row.innerHTML = `
      <div class="reaction-person-main">
        <img src="${escapeHtml(entry.avatar_data_url)}" alt="Reaction avatar">
        <div class="reaction-person-meta">
          <strong>${escapeHtml(entry.display_name)}</strong>
          <span>reacted with ${escapeHtml(entry.reaction_name)}</span>
        </div>
      </div>
      <div class="reaction-person-icon">${reactionMeta[entry.reaction_name]?.emoji || "👍"}</div>
    `;
    fragment.appendChild(row);
  });

  reactionModalList.appendChild(fragment);
}

function closeReactionModal() {
  reactionModal.classList.add("hidden");
}

function addFallbackComment(text) {
  fallbackStore.comments.unshift({
    id: createId(),
    profile_id: state.user.id,
    display_name: state.user.name,
    avatar_data_url: state.user.avatar,
    body_text: text
  });
  applyFallbackToState();
  renderComments();
  renderReactionState();
}

function deleteFallbackComment(commentId) {
  fallbackStore.comments = fallbackStore.comments.filter((comment) => comment.id !== commentId);
  applyFallbackToState();
  renderComments();
  renderReactionState();
}

function toggleFallbackReaction(reaction) {
  if (state.selectedReaction === reaction) {
    delete fallbackStore.reactionsByUser[state.user.id];
  } else {
    fallbackStore.reactionsByUser[state.user.id] = reaction;
  }
  applyFallbackToState();
  renderReactionState();
  renderReactionModal();
}

function applyFallbackToState() {
  state.comments = [...fallbackStore.comments];
  state.selectedReaction = state.user ? fallbackStore.reactionsByUser[state.user.id] || null : null;
  state.reactions = Object.values(fallbackStore.reactionsByUser).reduce((summary, reaction) => {
    summary[reaction] = (summary[reaction] || 0) + 1;
    return summary;
  }, {});
  state.reactionPeople = Object.entries(fallbackStore.reactionsByUser).map(([userId, reactionName]) => ({
    reaction_name: reactionName,
    display_name: state.user && userId === state.user.id ? state.user.name : "Student",
    avatar_data_url: state.user && userId === state.user.id ? state.user.avatar : "",
    created_at: Date.now()
  }));
}

async function ensureProfile() {
  if (!state.user) {
    return;
  }

  await supabaseRequest("/rest/v1/factbook_profiles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify({
      id: state.user.id,
      display_name: state.user.name,
      avatar_data_url: state.user.avatar,
      password_hint: ""
    })
  }, true);
}

async function createComment(text) {
  return supabaseRequest("/rest/v1/factbook_comments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      id: createId(),
      post_id: POST_ID,
      profile_id: state.user.id,
      display_name: state.user.name,
      avatar_data_url: state.user.avatar,
      body_text: text.slice(0, 220)
    })
  }, true);
}

async function deleteComment(commentId) {
  return supabaseRequest(`/rest/v1/factbook_comments?id=eq.${encodeURIComponent(commentId)}&profile_id=eq.${encodeURIComponent(state.user.id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" }
  }, true);
}

async function upsertReaction(reaction) {
  return supabaseRequest("/rest/v1/factbook_reactions?on_conflict=post_id,profile_id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify({
      id: `${POST_ID}-${state.user.id}`,
      post_id: POST_ID,
      profile_id: state.user.id,
      reaction_name: reaction
    })
  }, true);
}

async function deleteReaction() {
  return supabaseRequest(`/rest/v1/factbook_reactions?post_id=eq.${encodeURIComponent(POST_ID)}&profile_id=eq.${encodeURIComponent(state.user.id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" }
  }, true);
}

async function getOwnReaction() {
  if (!state.user) {
    return null;
  }

  const rows = await supabaseRequest(`/rest/v1/factbook_reactions?post_id=eq.${encodeURIComponent(POST_ID)}&profile_id=eq.${encodeURIComponent(state.user.id)}&select=reaction_name`);
  return rows[0] ? rows[0].reaction_name : null;
}

async function listComments() {
  return supabaseRequest(`/rest/v1/factbook_comments?post_id=eq.${encodeURIComponent(POST_ID)}&select=id,profile_id,display_name,avatar_data_url,body_text,created_at&order=created_at.desc`);
}

async function listReactions() {
  const rows = await supabaseRequest(`/rest/v1/factbook_reactions?post_id=eq.${encodeURIComponent(POST_ID)}&select=reaction_name`);
  return rows.reduce((summary, row) => {
    summary[row.reaction_name] = (summary[row.reaction_name] || 0) + 1;
    return summary;
  }, {});
}

async function listReactionPeople() {
  const rows = await supabaseRequest(`/rest/v1/factbook_reactions?post_id=eq.${encodeURIComponent(POST_ID)}&select=reaction_name,profile_id,created_at&order=created_at.desc`);
  if (!rows.length) {
    return [];
  }

  const ids = [...new Set(rows.map((row) => row.profile_id))];
  const idFilter = ids.map((id) => `"${id}"`).join(",");
  const profiles = await supabaseRequest(`/rest/v1/factbook_profiles?id=in.(${idFilter})&select=id,display_name,avatar_data_url`);
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

  return rows.map((row) => {
    const profile = profileMap.get(row.profile_id);
    return {
      reaction_name: row.reaction_name,
      display_name: profile ? profile.display_name : "Student",
      avatar_data_url: profile ? profile.avatar_data_url : "",
      created_at: row.created_at
    };
  });
}

async function supabaseRequest(path, options = {}, allowEmpty = false) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    if (allowEmpty && response.status === 204) {
      return [];
    }
    throw new Error(`Supabase request failed: ${response.status}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

function clearLoginForm() {
  loginForm.reset();
  photoPreview.innerHTML = "<span>No photo selected</span>";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function spawnReactionBurst(emoji) {
  const burst = document.createElement("div");
  burst.className = "reaction-burst";
  burst.textContent = emoji;
  document.body.appendChild(burst);
  window.setTimeout(() => burst.remove(), 650);
}

function pulseShareButton(label) {
  const original = shareButton.innerHTML;
  shareButton.textContent = label;
  shareButton.style.color = "#1877f2";
  window.setTimeout(() => {
    shareButton.innerHTML = original;
    shareButton.style.color = "";
  }, 1500);
}

function copyWithTextarea(value) {
  const helper = document.createElement("textarea");
  helper.value = value;
  helper.setAttribute("readonly", "");
  helper.style.position = "absolute";
  helper.style.left = "-9999px";
  document.body.appendChild(helper);
  helper.select();
  document.execCommand("copy");
  helper.remove();
}

function forceScrollTop() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function createId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
