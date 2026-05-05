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
const postAvatar = document.getElementById("postAvatar");
const composerAvatar = document.getElementById("composerAvatar");
const topbarName = document.getElementById("topbarName");
const logoutButton = document.getElementById("logoutButton");
const reactButton = document.getElementById("reactButton");
const reactWrap = reactButton ? reactButton.parentElement : null;
const reactionPicker = document.getElementById("reactionPicker");
const currentReactionIcon = document.getElementById("currentReactionIcon");
const currentReactionLabel = document.getElementById("currentReactionLabel");
const reactionCount = document.getElementById("reactionCount");
const reactionSummaryButton = document.getElementById("reactionSummaryButton");
const commentCount = document.getElementById("commentCount");
const commentForm = document.getElementById("commentForm");
const commentInput = document.getElementById("commentInput");
const commentList = document.getElementById("commentList");
const commentTemplate = document.getElementById("commentTemplate");
const commentFocusButton = document.getElementById("commentFocusButton");
const shareButton = document.getElementById("shareButton");
const reactionIconsStack = document.getElementById("reactionIconsStack");
const qrImage = document.getElementById("qrImage");
const qrLink = document.getElementById("qrLink");
const reactionModal = document.getElementById("reactionModal");
const reactionModalBackdrop = document.getElementById("reactionModalBackdrop");
const reactionModalClose = document.getElementById("reactionModalClose");
const reactionModalList = document.getElementById("reactionModalList");
const reactionFilterRow = document.getElementById("reactionFilterRow");

const reactionMeta = {
  Like: { emoji: "👍", color: "#1877f2", className: "like" },
  Love: { emoji: "❤️", color: "#f33e58", className: "love" },
  Care: { emoji: "🤗", color: "#f7b125", className: "care" },
  Haha: { emoji: "😂", color: "#f7b125", className: "haha" },
  Wow: { emoji: "😮", color: "#f7b125", className: "wow" },
  Sad: { emoji: "😢", color: "#f7b125", className: "sad" },
  Angry: { emoji: "😡", color: "#e4602a", className: "angry" }
};

const state = {
  user: null,
  refreshTimer: null,
  comments: [],
  reactions: {},
  selectedReaction: null,
  reactionPeople: [],
  activeReactionFilter: "All"
};

if (studentPhoto) {
  studentPhoto.addEventListener("change", () => {
    const [file] = studentPhoto.files;
    if (!file) {
      if (photoPreview) {
        photoPreview.innerHTML = "<span>No photo selected</span>";
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (photoPreview) {
        photoPreview.innerHTML = `<img src="${reader.result}" alt="Selected profile preview">`;
      }
    };
    reader.readAsDataURL(file);
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = studentName ? studentName.value.trim() : "";
    const password = studentPassword ? studentPassword.value.trim() : "";
    const [file] = studentPhoto ? studentPhoto.files : [];

    if (!name || !password || !file) {
      return;
    }

    const avatar = await readFileAsDataUrl(file);
    const userId = createId();
    const user = {
      id: userId,
      display_name: name.slice(0, 60),
      password_hint: password.slice(0, 60),
      avatar_data_url: avatar
    };

    state.user = {
      id: user.id,
      name: user.display_name,
      avatar: user.avatar_data_url
    };

    clearLoginForm();
    showFeed();
    upsertProfile(user).catch(() => {});
    await refreshFeed().catch(() => {});
  });
}

if (reactButton && reactWrap) {
  reactButton.addEventListener("click", () => {
    if (!state.user) {
      return;
    }
    reactWrap.classList.toggle("open");
  });
}

if (reactionPicker) {
  reactionPicker.querySelectorAll(".picker-react").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!state.user) {
        return;
      }

      const reaction = button.dataset.reaction;
    if (state.selectedReaction === reaction) {
      await deleteReaction(state.user.id);
    } else {
      await upsertReaction(state.user.id, reaction);
    }

    if (reactWrap) {
      reactWrap.classList.remove("open");
    }
    spawnReactionBurst(reactionMeta[reaction].emoji);
    await refreshFeed().catch(() => {});
  });
});
}

document.addEventListener("click", (event) => {
  if (reactWrap && !reactWrap.contains(event.target)) {
    reactWrap.classList.remove("open");
  }
});

if (commentFocusButton && commentInput) {
  commentFocusButton.addEventListener("click", () => {
    commentInput.focus();
  });
}

if (shareButton) {
  shareButton.addEventListener("click", async () => {
    const shareUrl = window.location.href;
    const shareText = "Join the discussion on Fact-Book.";

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Fact-Book",
          text: shareText,
          url: shareUrl
        });
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
}

if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    resetSession();
  });
}

if (reactionSummaryButton) {
  reactionSummaryButton.addEventListener("click", () => {
    openReactionModal();
  });
}

if (reactionModalClose) {
  reactionModalClose.addEventListener("click", closeReactionModal);
}

if (reactionModalBackdrop) {
  reactionModalBackdrop.addEventListener("click", closeReactionModal);
}

if (commentForm) {
  commentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.user) {
      return;
    }

    const text = commentInput ? commentInput.value.trim() : "";
    if (!text) {
      return;
    }

    await ensureProfile();
    await createComment(state.user.id, text);
    if (commentInput) {
      commentInput.value = "";
    }
    await refreshFeed().catch(() => {});
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeReactionModal();
  }
});

window.addEventListener("load", () => {
  renderQrCode();
  resetSession(true);
});

async function refreshFeed() {
  const [comments, reactions, ownReaction, reactionPeople] = await Promise.all([
    listComments(),
    listReactions(),
    state.user ? getOwnReaction(state.user.id) : Promise.resolve(null),
    listReactionPeople()
  ]);

  state.comments = comments;
  state.reactions = reactions;
  state.selectedReaction = ownReaction;
  state.reactionPeople = reactionPeople;
  renderReactionState();
  renderComments();
  renderReactionModal();
}

function showFeed() {
  if (!authScreen || !feedScreen) {
    return;
  }

  authScreen.classList.add("hidden");
  feedScreen.classList.remove("hidden");
  if (topbarName) {
    topbarName.textContent = state.user.name;
  }
  forceScrollTop();

  [topbarAvatar, postAvatar, composerAvatar].forEach((image) => {
    if (image) {
      image.src = state.user.avatar;
    }
  });

  if (!state.refreshTimer) {
    state.refreshTimer = window.setInterval(() => {
      refreshFeed().catch(() => {});
    }, 4000);
  }
}

function resetSession(isInitialLoad = false) {
  state.user = null;
  state.selectedReaction = null;
  state.comments = [];
  state.reactions = {};
  state.reactionPeople = [];
  state.activeReactionFilter = "All";

  if (state.refreshTimer) {
    window.clearInterval(state.refreshTimer);
    state.refreshTimer = null;
  }

  if (feedScreen) {
    feedScreen.classList.add("hidden");
  }
  if (authScreen) {
    authScreen.classList.remove("hidden");
  }
  forceScrollTop();
  clearLoginForm();
  if (reactWrap) {
    reactWrap.classList.remove("open");
  }
  closeReactionModal();

  if (reactionCount) {
    reactionCount.textContent = "0 reactions";
  }
  if (commentCount) {
    commentCount.textContent = "0 comments";
  }
  if (currentReactionIcon) {
    currentReactionIcon.textContent = "👍";
  }
  if (currentReactionLabel) {
    currentReactionLabel.textContent = "React";
  }
  if (reactButton) {
    reactButton.style.color = "#5c6778";
  }

  if (reactionIconsStack) {
    reactionIconsStack.innerHTML = `
      <span class="mini-react like">👍</span>
      <span class="mini-react love">❤️</span>
      <span class="mini-react wow">😮</span>
    `;
  }

  if (!isInitialLoad) {
    if (topbarName) {
      topbarName.textContent = "";
    }
    [topbarAvatar, postAvatar, composerAvatar].forEach((image) => {
      if (image) {
        image.removeAttribute("src");
      }
    });
    if (commentList) {
      commentList.innerHTML = "";
    }
  }
}

function renderReactionState() {
  if (!reactionIconsStack || !reactionCount || !commentCount || !currentReactionIcon || !currentReactionLabel || !reactButton) {
    return;
  }

  const totals = Object.entries(state.reactions).sort((left, right) => right[1] - left[1]);
  const totalCount = totals.reduce((sum, entry) => sum + entry[1], 0);

  reactionIconsStack.innerHTML = "";
  totals.slice(0, 3).forEach(([name]) => {
    const meta = reactionMeta[name];
    const chip = document.createElement("span");
    chip.className = `mini-react ${meta.className}`;
    chip.textContent = meta.emoji;
    reactionIconsStack.appendChild(chip);
  });

  if (!totals.length) {
    ["Like", "Love", "Wow"].forEach((name) => {
      const meta = reactionMeta[name];
      const chip = document.createElement("span");
      chip.className = `mini-react ${meta.className}`;
      chip.textContent = meta.emoji;
      reactionIconsStack.appendChild(chip);
    });
  }

  reactionCount.textContent = totalCount === 0 ? "0 reactions" : `${totalCount} reaction${totalCount === 1 ? "" : "s"}`;
  commentCount.textContent = `${state.comments.length} comment${state.comments.length === 1 ? "" : "s"}`;

  if (!state.selectedReaction) {
    currentReactionIcon.textContent = "👍";
    currentReactionLabel.textContent = "React";
    reactButton.style.color = "#5c6778";
    return;
  }

  const meta = reactionMeta[state.selectedReaction];
  currentReactionIcon.textContent = meta.emoji;
  currentReactionLabel.textContent = state.selectedReaction;
  reactButton.style.color = meta.color;
}

function renderReactionModal() {
  if (!reactionFilterRow || !reactionModalList) {
    return;
  }

  const totals = [
    { name: "All", count: state.reactionPeople.length, emoji: "All" },
    ...Object.entries(state.reactions)
      .sort((left, right) => right[1] - left[1])
      .map(([name, count]) => ({ name, count, emoji: reactionMeta[name].emoji }))
  ];

  reactionFilterRow.innerHTML = "";
  totals.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `reaction-filter-btn${state.activeReactionFilter === entry.name ? " active" : ""}`;
    button.textContent = `${entry.emoji} ${entry.count}`;
    button.addEventListener("click", () => {
      state.activeReactionFilter = entry.name;
      renderReactionModal();
    });
    reactionFilterRow.appendChild(button);
  });

  const visiblePeople = state.activeReactionFilter === "All"
    ? state.reactionPeople
    : state.reactionPeople.filter((person) => person.reaction_name === state.activeReactionFilter);

  reactionModalList.innerHTML = "";

  if (!visiblePeople.length) {
    reactionModalList.innerHTML = `<div class="reaction-empty">No reactions to show for this filter yet.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  visiblePeople.forEach((person) => {
    const row = document.createElement("article");
    row.className = "reaction-person";
    row.innerHTML = `
      <div class="reaction-person-main">
        <img src="${escapeHtml(person.avatar_data_url)}" alt="Reaction avatar">
        <div class="reaction-person-meta">
          <strong>${escapeHtml(person.display_name)}</strong>
          <span>reacted with ${escapeHtml(person.reaction_name)}</span>
        </div>
      </div>
      <div class="reaction-person-icon">${reactionMeta[person.reaction_name]?.emoji || "👍"}</div>
    `;
    fragment.appendChild(row);
  });

  reactionModalList.appendChild(fragment);
}

function openReactionModal() {
  if (!reactionModal) {
    return;
  }
  renderReactionModal();
  reactionModal.classList.remove("hidden");
}

function closeReactionModal() {
  if (!reactionModal) {
    return;
  }
  reactionModal.classList.add("hidden");
}

function renderComments() {
  if (!commentList) {
    return;
  }

  commentList.innerHTML = "";

  if (!state.comments.length) {
    commentList.innerHTML = `
      <article class="comment-item">
        <div class="comment-placeholder-icon">💬</div>
        <div class="comment-bubble">
          <strong class="comment-author">Start the discussion</strong>
          <p>Use the comment box to explain why the statement is right or wrong.</p>
        </div>
      </article>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();
  state.comments.forEach((comment) => {
    if (state.user && comment.profile_id === state.user.id) {
      const article = document.createElement("article");
      article.className = "comment-item owned";
      article.innerHTML = `
        <div class="comment-main">
          <img class="comment-avatar" alt="Comment avatar" src="${escapeHtml(comment.avatar_data_url)}">
          <div class="comment-bubble">
            <strong class="comment-author"></strong>
            <p class="comment-text"></p>
          </div>
        </div>
        <button type="button" class="comment-delete-btn" data-comment-id="${escapeHtml(comment.id)}">Delete</button>
      `;
      article.querySelector(".comment-author").textContent = comment.display_name;
      article.querySelector(".comment-text").textContent = comment.body_text;
      article.querySelector(".comment-delete-btn").addEventListener("click", async () => {
        await deleteComment(comment.id, state.user.id);
        await refreshFeed();
      });
      fragment.appendChild(article);
      return;
    }

    if (!commentTemplate) {
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

function renderQrCode() {
  if (!qrImage || !qrLink) {
    return;
  }

  const targetUrl = window.location.href;
  qrLink.textContent = targetUrl;
  qrLink.href = targetUrl;
  qrImage.style.display = "";

  const qrSources = [
    `https://quickchart.io/qr?size=220&text=${encodeURIComponent(targetUrl)}`,
    `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(targetUrl)}`,
    `https://chart.googleapis.com/chart?cht=qr&chs=220x220&chl=${encodeURIComponent(targetUrl)}`
  ];

  let sourceIndex = 0;
  qrImage.onerror = () => {
    sourceIndex += 1;
    if (sourceIndex < qrSources.length) {
      qrImage.src = qrSources[sourceIndex];
      return;
    }

    qrImage.alt = "QR code unavailable";
    qrImage.style.display = "none";
  };

  qrImage.src = qrSources[sourceIndex];
}

function clearLoginForm() {
  if (!loginForm || !photoPreview) {
    return;
  }
  loginForm.reset();
  photoPreview.innerHTML = "<span>No photo selected</span>";
}

function spawnReactionBurst(emoji) {
  const burst = document.createElement("div");
  burst.className = "reaction-burst";
  burst.textContent = emoji;
  document.body.appendChild(burst);
  window.setTimeout(() => burst.remove(), 650);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function upsertProfile(profile) {
  return supabaseRequest("/rest/v1/factbook_profiles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(profile)
  }, true);
}

async function ensureProfile() {
  if (!state.user) {
    return;
  }

  await upsertProfile({
    id: state.user.id,
    display_name: state.user.name,
    password_hint: "",
    avatar_data_url: state.user.avatar
  });
}

async function getOwnReaction(userId) {
  const rows = await supabaseRequest(`/rest/v1/factbook_reactions?post_id=eq.${encodeURIComponent(POST_ID)}&profile_id=eq.${encodeURIComponent(userId)}&select=reaction_name`);
  return rows[0] ? rows[0].reaction_name : null;
}

async function createComment(userId, text) {
  return supabaseRequest("/rest/v1/factbook_comments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      id: createId(),
      post_id: POST_ID,
      profile_id: userId,
      display_name: state.user.name,
      avatar_data_url: state.user.avatar,
      body_text: text.slice(0, 220)
    })
  }, true);
}

async function listComments() {
  return supabaseRequest(`/rest/v1/factbook_comments?post_id=eq.${encodeURIComponent(POST_ID)}&select=id,profile_id,display_name,avatar_data_url,body_text,created_at&order=created_at.desc`);
}

async function deleteComment(commentId, userId) {
  return supabaseRequest(`/rest/v1/factbook_comments?id=eq.${encodeURIComponent(commentId)}&profile_id=eq.${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal"
    }
  }, true);
}

async function upsertReaction(userId, reaction) {
  await ensureProfile();
  return supabaseRequest(`/rest/v1/factbook_reactions?on_conflict=post_id,profile_id`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify({
      id: `${POST_ID}-${userId}`,
      post_id: POST_ID,
      profile_id: userId,
      reaction_name: reaction
    })
  }, true);
}

async function deleteReaction(userId) {
  return supabaseRequest(`/rest/v1/factbook_reactions?post_id=eq.${encodeURIComponent(POST_ID)}&profile_id=eq.${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal"
    }
  }, true);
}

async function listReactions() {
  const rows = await supabaseRequest(`/rest/v1/factbook_reactions?post_id=eq.${encodeURIComponent(POST_ID)}&select=reaction_name`);
  return rows.reduce((summary, row) => {
    summary[row.reaction_name] = (summary[row.reaction_name] || 0) + 1;
    return summary;
  }, {});
}

async function listReactionPeople() {
  const reactions = await supabaseRequest(`/rest/v1/factbook_reactions?post_id=eq.${encodeURIComponent(POST_ID)}&select=reaction_name,created_at,profile_id&order=created_at.desc`);
  if (!reactions.length) {
    return [];
  }

  const uniqueIds = [...new Set(reactions.map((row) => row.profile_id).filter(Boolean))];
  const profiles = await supabaseRequest(`/rest/v1/factbook_profiles?id=in.(${uniqueIds.map((id) => `"${encodeURIComponent(id)}"`).join(",")})&select=id,display_name,avatar_data_url`);
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

  return reactions.map((row) => {
    const profile = profileMap.get(row.profile_id);
    return {
      reaction_name: row.reaction_name,
      display_name: profile?.display_name || "Student",
      avatar_data_url: profile?.avatar_data_url || "",
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

function pulseShareButton(label) {
  if (!shareButton) {
    return;
  }
  const original = shareButton.innerHTML;
  shareButton.textContent = label;
  shareButton.style.color = "#1877f2";
  window.setTimeout(() => {
    shareButton.innerHTML = original;
    shareButton.style.color = "";
  }, 1600);
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
