"use strict";
(() => {
  const root = document.getElementById("live-workbench");
  if (!root) return;
  const eventsRoot = document.getElementById("workbench-events");
  const reposRoot = document.getElementById("workbench-repos");
  const status = document.getElementById("workbench-sync");
  const refresh = document.getElementById("workbench-refresh");
  const api = "https://api.github.com";
  const tracked = [
    "danielbrownjr/DragonBreath",
    "danielbrownjr/BandiC5",
    "thetechbenders/badger-i-hardly-knew-her"
  ];
  const eventLabels = {
    PushEvent: "Pushed commits",
    PullRequestEvent: "Worked on a pull request",
    IssuesEvent: "Updated an issue",
    ReleaseEvent: "Published a release",
    CreateEvent: "Created a branch or tag",
    PullRequestReviewEvent: "Reviewed a pull request"
  };
  const placeholder = "Public GitHub data is unavailable right now. The projects below are still accessible.";
  let lastFetch = 0;
  let busy = false;

  function node(tag, className, content) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content !== undefined) el.textContent = content;
    return el;
  }
  function repoUrl(name) {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name)) return null;
    return "https://github.com/" + name;
  }
  function relativeDate(value) {
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) return "date unknown";
    const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (seconds < 60) return "just now";
    const units = [[86400,"d"],[3600,"h"],[60,"m"]];
    for (const [size,label] of units) {
      if (seconds >= size) return Math.floor(seconds/size) + label + " ago";
    }
    return seconds + "s ago";
  }
  async function getJson(path) {
    const response = await fetch(api + path, {
      headers: {Accept:"application/vnd.github+json"},
      cache:"no-store"
    });
    if (!response.ok) throw new Error("GitHub API HTTP " + response.status);
    return response.json();
  }
  function setStatus(message, state) {
    status.textContent = message;
    status.dataset.state = state;
  }
  function empty(el, message) {
    el.replaceChildren(node("li", "workbench-event-empty", message));
  }
  function showEvents(events) {
    eventsRoot.replaceChildren();
    const chosen = Array.isArray(events) ? events.filter(e =>
      e && e.public === true && eventLabels[e.type] &&
      e.repo && typeof e.repo.name === "string" && repoUrl(e.repo.name)
    ).slice(0, 5) : [];
    if (!chosen.length) {
      empty(eventsRoot, "No recent supported public activity found. Quiet days happen, allegedly.");
      return;
    }
    for (const event of chosen) {
      const item = node("li", "workbench-event");
      item.append(node("span", "workbench-event-dot"));
      const body = node("div");
      const head = node("div", "workbench-event-title");
      head.append(node("strong", null, eventLabels[event.type]));
      const time = node("time", null, relativeDate(event.created_at));
      if (event.created_at && !Number.isNaN(Date.parse(event.created_at))) time.dateTime = event.created_at;
      head.append(time);
      body.append(head);
      const link = node("a", "workbench-event-repo", event.repo.name);
      link.href = repoUrl(event.repo.name);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      body.append(link);
      item.append(body);
      eventsRoot.append(item);
    }
  }
  function repoFallback(name) {
    return {full_name:name, pushed_at:null, stargazers_count:null};
  }
  function showRepos(repos) {
    reposRoot.replaceChildren();
    for (const repo of repos) {
      const url = repoUrl(repo.full_name);
      if (!url) continue;
      const link = node("a", "workbench-repo");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      const heading = node("div", "workbench-repo-top");
      heading.append(node("strong", null, repo.full_name.split("/")[1]));
      heading.append(node("span", "workbench-repo-arrow", "↗"));
      link.append(heading);
      const detail = node("div", "workbench-repo-detail");
      detail.append(node("span", null, repo.pushed_at ? "LAST PUSH · " + relativeDate(repo.pushed_at) : "LAST PUSH · UNAVAILABLE"));
      const stars = node("span", null, Number.isFinite(repo.stargazers_count) ? "★ " + repo.stargazers_count.toLocaleString() : "STATS UNAVAILABLE");
      detail.append(stars);
      link.append(detail);
      reposRoot.append(link);
    }
  }
  async function load() {
    if (busy || (Date.now() - lastFetch < 60000)) return;
    lastFetch = Date.now();
    busy = true;
    refresh.disabled = true;
    setStatus("READING PUBLIC GITHUB DATA…", "loading");
    const results = await Promise.allSettled([
      getJson("/users/danielbrownjr/events/public?per_page=30"),
      ...tracked.map(name => getJson("/repos/" + name))
    ]);
    const activity = results[0];
    const repoResults = results.slice(1);
    if (activity.status === "fulfilled") showEvents(activity.value);
    else empty(eventsRoot, "Recent public activity could not be fetched.");
    const visibleRepos = repoResults.map((r, i) => {
      if (r.status !== "fulfilled" || !r.value || r.value.private === true) return repoFallback(tracked[i]);
      return r.value;
    });
    showRepos(visibleRepos);
    const successful = results.filter(r => r.status === "fulfilled").length;
    const now = new Date().toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});
    setStatus(successful === results.length ? "SYNCED " + now + " · PUBLIC DATA" :
      successful ? "PARTIAL SYNC " + now + " · PUBLIC DATA" : "GITHUB API UNAVAILABLE · LINKS STILL WORK",
      successful === results.length ? "ok" : "error");
    refresh.disabled = false;
    busy = false;
  }
  refresh.addEventListener("click", () => load());
  showRepos(tracked.map(repoFallback));
  empty(eventsRoot, "Fetching recent public activity…");
  load().catch(() => {
    empty(eventsRoot, placeholder);
    showRepos(tracked.map(repoFallback));
    setStatus("GITHUB API UNAVAILABLE · LINKS STILL WORK", "error");
    refresh.disabled = false;
    busy = false;
  });
})();
