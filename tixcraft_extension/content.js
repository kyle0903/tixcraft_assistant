// 將圖片 URL 轉換為 base64
async function urlToBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("轉換 base64 時發生錯誤:", error);
    return null;
  }
}

async function getCode(imageUrl) {
  try {
    // 將圖片轉換為 base64
    const base64Image = await urlToBase64(imageUrl);
    if (!base64Image) {
      throw new Error("無法轉換圖片為 base64");
    }

    const response = await fetch(
      "https://tixcraft-assistant.onrender.com/analyze-image",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: base64Image,
        }),
      }
    );

    if (!response.ok) {
      console.log(response);
      throw new Error("後端服務錯誤");
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

// 判斷是否為重新整理
function isPageRefresh() {
  const navigation = window.performance.getEntriesByType("navigation")[0];
  return navigation.type === "reload";
}

// 監聽頁面變化
async function checkAndFillVerifyCode() {
  try {
    console.log("是否為重新整理:", isPageRefresh());
    // 使用更精確的選擇器
    const verifyCodeInput = document.getElementById("TicketForm_verifyCode");

    // 尋找所有 select 元素
    const selects = document.querySelectorAll("select");

    const agreeInput = document.querySelector('input[type="checkbox"]');

    const submitButton = document.querySelector('button[type="submit"]');

    const captchaImage = document.getElementById("TicketForm_verifyCode-image");

    const captchaImageUrl = captchaImage.src;

    console.log(captchaImageUrl);

    selects.forEach((select) => {
      // 檢查這個 select 是否有 1,2,3,4 的選項
      const hasValidOptions = Array.from(select.options).some((option) =>
        ["1", "2", "3", "4"].includes(option.value)
      );

      if (hasValidOptions) {
        console.log("找到票券選擇器:", select.id);

        // 從 storage 讀取票券數量
        chrome.storage.sync.get(["ticketCount"], function (result) {
          if (result.ticketCount) {
            select.value = result.ticketCount;
          } else {
            select.value = "1";
          }
        });
      }
    });

    if (agreeInput) {
      agreeInput.checked = true;
    }

    // 如果驗證碼輸入框存在且沒有值，才獲取新的驗證碼
    if (verifyCodeInput && !verifyCodeInput.value) {
      const code = await getCode(captchaImageUrl);
      if (code) {
        verifyCodeInput.value = code;
      }
    }

    if (submitButton) {
      chrome.storage.sync.get(["autoSubmit"], function (result) {
        if (result.autoSubmit && verifyCodeInput.value && agreeInput.checked) {
          submitButton.click();
        }
      });
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

// 直接執行函數，而不是等待 DOMContentLoaded
checkAndFillVerifyCode();
