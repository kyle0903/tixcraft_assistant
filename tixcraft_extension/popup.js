// 載入已儲存的設定
chrome.storage.sync.get(["ticketCount", "autoSubmit"], function (result) {
  if (result.ticketCount) {
    document.getElementById("ticketCount").value = result.ticketCount;
  }
  if (result.autoSubmit !== undefined) {
    document.getElementById("autoSubmit").checked = result.autoSubmit;
  }
});

// 儲存設定
document.getElementById("saveSettings").addEventListener("click", function () {
  const settings = {
    ticketCount: document.getElementById("ticketCount").value,
    autoSubmit: document.getElementById("autoSubmit").checked,
  };

  chrome.storage.sync.set(settings, function () {
    const status = document.getElementById("status");
    status.textContent = "設定已儲存！";
    setTimeout(() => {
      status.textContent = "";
    }, 2000);
  });
});
