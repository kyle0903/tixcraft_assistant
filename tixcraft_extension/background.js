// 擴充功能安裝時執行
chrome.runtime.onInstalled.addListener(() => {
  console.log("擴充功能已安裝");
});
