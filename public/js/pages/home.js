import {
  auth, subscribeToFeed, postToFeed, replyToFeed,
  updateFeedPost, deleteFeedPost, getUserDoc
} from '../firebase.js';

let unsubscribe = null;
let currentUserData = null;
let lastRenderState = null;

export function mountHome(container, userData) {
  currentUserData = userData;
  container.innerHTML = `
    <h1 class="page-heading">Staff Hub</h1>
    <p class="page-subheading">Internal communications for John K. King staff.</p>

    <div class="composer">
      <textarea id="feed-composer" placeholder="Post an update, question, or note…"></textarea>
      <div style="display:flex;justify-content:flex-end;align-items:center;gap:0.75rem;margin-top:0.6rem">
        <span class="status-msg" id="post-status"></span>
        <button class="btn btn-primary" id="feed-post-btn">Post</button>
      </div>
    </div>

    <div id="feed-list"></div>
  `;

  const textarea = container.querySelector('#feed-composer');
  const postBtn = container.querySelector('#feed-post-btn');
  const postStatus = container.querySelector('#post-status');

  async function submitPost() {
    const content = textarea.value.trim();
    if (!content) return;
    postBtn.disabled = true;
    postStatus.textContent = '';
    try {
      await postToFeed(content);
      textarea.value = '';
    } catch (e) {
      console.error('Post failed:', e);
      postStatus.textContent = 'Failed to post.';
      postStatus.className = 'status-msg error';
    } finally {
      postBtn.disabled = false;
    }
  }

  postBtn.addEventListener('click', submitPost);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitPost(); }
  });

  if (unsubscribe) unsubscribe();
  unsubscribe = subscribeToFeed(async (posts, error) => {
    const feedList = document.getElementById('feed-list');
    if (!feedList) return;

    if (error) {
      feedList.innerHTML = `<div class="empty-state"><p class="empty-state-desc" style="color:#b91c1c">Could not load posts. (${error.code || error.message})</p></div>`;
      return;
    }

    if (posts.length === 0) {
      feedList.innerHTML = `<div class="empty-state"><p class="empty-state-title">Nothing here yet</p><p class="empty-state-desc">Be the first to post.</p></div>`;
      return;
    }

    const userIds = [...new Set(posts.map(p => p.authorId))];
    const userDocs = await Promise.all(userIds.map(uid => getUserDoc(uid)));
    const usersById = {};
    userDocs.filter(Boolean).forEach(u => { usersById[u.id] = u; });

    const topPosts = posts.filter(p => !p.replyTo);
    const repliesByParent = {};
    posts.filter(p => p.replyTo).forEach(p => {
      if (!repliesByParent[p.replyTo]) repliesByParent[p.replyTo] = [];
      repliesByParent[p.replyTo].push(p);
    });

    lastRenderState = { topPosts, usersById, repliesByParent };

    feedList.innerHTML = '';
    topPosts.forEach(post => {
      const el = buildPostEl(post, usersById, repliesByParent, false);
      feedList.appendChild(el);
    });
  });
}

export function unmountHome() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  lastRenderState = null;
}

function formatTs(ts) {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function buildPostEl(post, usersById, repliesByParent, isReply) {
  const user = auth.currentUser;
  const authorName = usersById[post.authorId]?.displayName || 'Staff';
  const initials = authorName.slice(0, 2).toUpperCase();
  const canEdit = user && (user.uid === post.authorId || currentUserData?.role === 'admin');
  const canDelete = canEdit;
  const replies = repliesByParent[post.id] || [];

  const wrapper = document.createElement('div');
  wrapper.className = isReply ? 'reply-post' : 'feed-post';
  wrapper.dataset.postId = post.id;

  wrapper.innerHTML = `
    <div style="display:flex;gap:0.75rem;align-items:flex-start">
      <div style="width:32px;height:32px;border-radius:50%;background:#e7e4de;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:var(--text-muted);flex-shrink:0">${initials}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:baseline;gap:0.5rem;flex-wrap:wrap">
          <span class="post-author">${escHtml(authorName)}</span>
          <span class="post-meta">${formatTs(post.timestamp)}${post.edited ? ' <span style="color:var(--text-muted)">(edited)</span>' : ''}</span>
        </div>
        <div class="post-content" id="post-content-${post.id}">${escHtml(post.content)}</div>
        <div class="post-actions">
          <button class="btn-ghost reply-btn">Reply</button>
          ${canEdit ? `<button class="btn-ghost edit-btn">Edit</button>` : ''}
          ${canDelete ? `<button class="btn-ghost danger delete-btn">Delete</button>` : ''}
          ${replies.length > 0 ? `<button class="btn-ghost toggle-replies-btn" data-expanded="false">${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}</button>` : ''}
        </div>
        <div class="reply-form-slot"></div>
        ${replies.length > 0 ? `<div class="post-replies hidden" id="replies-${post.id}"></div>` : ''}
      </div>
    </div>
  `;

  // Populate replies
  if (replies.length > 0) {
    const repliesContainer = wrapper.querySelector(`#replies-${post.id}`);
    replies.forEach(reply => {
      repliesContainer.appendChild(buildPostEl(reply, usersById, repliesByParent, true));
    });
  }

  // Toggle replies
  const toggleBtn = wrapper.querySelector('.toggle-replies-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const container = wrapper.querySelector(`#replies-${post.id}`);
      const expanded = toggleBtn.dataset.expanded === 'true';
      container.classList.toggle('hidden', expanded);
      toggleBtn.dataset.expanded = String(!expanded);
      toggleBtn.textContent = expanded
        ? `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`
        : 'Hide replies';
    });
  }

  // Reply
  wrapper.querySelector('.reply-btn').addEventListener('click', () => {
    const slot = wrapper.querySelector('.reply-form-slot');
    if (slot.querySelector('.inline-reply-form')) { slot.innerHTML = ''; return; }
    slot.innerHTML = `
      <div class="inline-reply-form" style="margin-top:0.75rem">
        <textarea class="input" rows="2" placeholder="Write a reply…" style="resize:vertical"></textarea>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.4rem">
          <button class="btn-ghost cancel-reply-btn">Cancel</button>
          <button class="btn btn-primary submit-reply-btn" style="padding:0.35rem 0.85rem;font-size:0.8rem">Reply</button>
        </div>
      </div>
    `;
    const ta = slot.querySelector('textarea');
    ta.focus();

    const submit = async () => {
      const content = ta.value.trim();
      if (!content) return;
      ta.disabled = true;
      try { await replyToFeed(content, post.id); slot.innerHTML = ''; }
      catch (e) { console.error('Reply failed:', e); ta.disabled = false; }
    };

    slot.querySelector('.cancel-reply-btn').addEventListener('click', () => { slot.innerHTML = ''; });
    slot.querySelector('.submit-reply-btn').addEventListener('click', submit);
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
  });

  // Edit
  const editBtn = wrapper.querySelector('.edit-btn');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      const contentEl = wrapper.querySelector(`#post-content-${post.id}`);
      const original = post.content;
      contentEl.innerHTML = `
        <textarea class="input" rows="3" style="margin-top:0.35rem;resize:vertical">${escHtml(original)}</textarea>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.4rem">
          <button class="btn-ghost cancel-edit-btn">Cancel</button>
          <button class="btn btn-primary save-edit-btn" style="padding:0.35rem 0.85rem;font-size:0.8rem">Save</button>
        </div>
      `;
      const ta = contentEl.querySelector('textarea');
      ta.focus();

      const save = async () => {
        const newContent = ta.value.trim();
        if (!newContent) return;
        try {
          await updateFeedPost(post.id, newContent);
        } catch (e) {
          console.error('Edit failed:', e);
          contentEl.textContent = original;
        }
      };

      contentEl.querySelector('.cancel-edit-btn').addEventListener('click', () => {
        contentEl.textContent = original;
      });
      contentEl.querySelector('.save-edit-btn').addEventListener('click', save);
      ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } });
    });
  }

  // Delete
  const deleteBtn = wrapper.querySelector('.delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      const actionsEl = wrapper.querySelector('.post-actions');
      actionsEl.innerHTML = `
        <span class="post-meta">Delete this post${!isReply ? ' and all replies' : ''}?</span>
        <button class="btn-ghost danger confirm-delete-btn">Yes, delete</button>
        <button class="btn-ghost cancel-delete-btn">Cancel</button>
      `;
      actionsEl.querySelector('.confirm-delete-btn').addEventListener('click', async () => {
        try { await deleteFeedPost(post.id); }
        catch (e) { console.error('Delete failed:', e); }
      });
      actionsEl.querySelector('.cancel-delete-btn').addEventListener('click', () => {
        rerenderFeed();
      });
    });
  }

  return wrapper;
}

function rerenderFeed() {
  const feedList = document.getElementById('feed-list');
  if (!feedList || !lastRenderState) return;
  const { topPosts, usersById, repliesByParent } = lastRenderState;
  feedList.innerHTML = '';
  topPosts.forEach(post => {
    feedList.appendChild(buildPostEl(post, usersById, repliesByParent, false));
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
