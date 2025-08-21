from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from openai import OpenAI
from dotenv import load_dotenv
import time
import re
from bs4 import BeautifulSoup

# 載入環境變數
load_dotenv()

app = Flask(__name__)
CORS(app)  # 允許跨域請求
# 初始化 OpenAI 客戶端
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
x_api_key = os.getenv('X-API-KEY')

@app.route('/')
def index():
    return jsonify({'message': 'Hello, World!'})

@app.route('/health', methods=['GET'])
def health():
    client_api_key = request.headers.get('X-API-Key')
    if client_api_key != x_api_key:
        return jsonify({'message': 'Unauthorized'}), 401
    else:
        return jsonify({'message': 'OK'})

@app.route('/analyze-image', methods=['POST'])
def analyze_image():
    try:
        client_api_key = request.headers.get('X-API-Key')
        if client_api_key != x_api_key:
            return jsonify({'message': 'Unauthorized'}), 401
        data = request.json
        base64_image = data.get('image')


        if not base64_image:
            return jsonify({'error': '沒有提供圖片'}), 400
        
        if "data:image" in base64_image:
            image_url = base64_image
        else:
            image_url = f"data:image/png;base64,{base64_image}"

        start_time = time.time()

        # 使用 OpenAI API 分析圖片
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": """
                            你是一個嚴格且沉默的 OCR 解碼器。請依規則讀取圖片中前景白色字母（忽略藍色背景與裝飾），並只輸出 4 個小寫英文字母（a–z）。
                            禁止輸出說明、標點、空白、換行、代碼框或其他任何字元。

                            1. 字形判斷規則（重點）：
                                i：上方有圓點；主幹不延伸到基線下方（無下行部）。
                                j：上方有圓點；主幹明顯延伸到基線下方（有下行部）。

                                若圓點缺失但有下行部 → 判為 j；無下行部 → 判為 i。

                                r：右側是短肩、無閉合圓腹、無下行部。
                                p：主幹有下行部，右側為閉合圓腹（看起來像 o 貼在右側）。
                            
                            2. 以多數字母底緣形成的水平線視為基線；任何筆畫明顯低於基線者視為下行部（關鍵於 j、p）。

                            3. 忽略輕微斷裂、邊緣鋸齒、反鋸齒暈染與小白點；以整體輪廓與是否有閉合圓腹/下行部作為最終依據。

                            4. 僅輸出恰好 4 個小寫英文字母（ASCII），不多不少。若有不確定，根據上述規則選擇最符合輪廓者，不要輸出其他符號或任何說明。

                            5. 輸出格式：僅輸出 4 字母字串，例如：abcd
                            """
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_url
                            }
                        }
                    ]
                }
            ],
            max_tokens=1000
        )
        end_time = time.time()        
        return jsonify({'text': response.choices[0].message.content, 'time': end_time - start_time})

    except Exception as e:
        return jsonify({'error': str(e)}), 400

# === 搶票邏輯 API 端點 ===

@app.route('/analyze-page', methods=['POST'])
def analyze_page():
    """分析頁面DOM，返回搶票指令"""
    try:
        client_api_key = request.headers.get('X-API-Key')
        if client_api_key != x_api_key:
            return jsonify({'message': 'Unauthorized'}), 401

        data = request.json
        page_type = data.get('pageType')
        html_content = data.get('htmlContent', '')
        url = data.get('url', '')
        user_settings = data.get('settings', {})

        if page_type == 'activity_game':
            return analyze_activity_page(html_content, url, user_settings)
        elif page_type == 'ticket_area':
            return analyze_ticket_area(html_content, url, user_settings)
        elif page_type == 'ticket_purchase':
            return analyze_purchase_page(html_content, url, user_settings)
        else:
            return jsonify({'action': 'wait', 'message': '未知頁面類型'})

    except Exception as e:
        return jsonify({'error': str(e)}), 400

def analyze_activity_page(html_content, url, settings):
    """分析活動頁面，判斷是否要搶票"""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # 尋找購買按鈕
    buy_buttons = soup.find_all(class_="btn btn-primary text-bold m-0")
    available_button = None
    
    for button in buy_buttons:
        if not button.get('disabled') and button.get('data-href'):
            available_button = button.get('data-href')
            break
    
    if available_button and settings.get('autoGrab', False):
        return jsonify({
            'action': 'redirect',
            'url': available_button,
            'message': '找到購買按鈕，正在進入購票頁面...'
        })
    
    # 檢查倒數計時
    countdown_elements = soup.find_all(class_="gridc fcTxt")
    has_countdown = False
    exclude_keywords = ['截止', '售完', '售罄', '結束']
    
    for element in countdown_elements:
        if element and 'text-center' in str(element) and not any(keyword in str(element) for keyword in exclude_keywords):
            has_countdown = True
            break
    
    if has_countdown and settings.get('autoGrab', False):
        return jsonify({
            'action': 'refresh',
            'delay': 1000,
            'message': '檢測到倒數計時，刷新頁面中...'
        })
    
    return jsonify({
        'action': 'wait',
        'message': '等待開賣或手動操作'
    })

def analyze_ticket_area(html_content, url, settings):
    """分析票種選擇頁面，返回要選擇的票種"""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    if not settings.get('autoSelectTicket', False):
        return jsonify({'action': 'wait', 'message': '自動選票已停用'})
    
    # 尋找所有票種連結
    ticket_links = soup.find_all('a', id=True)
    valid_tickets = []
    
    exclude_keywords = ['wheelchair', '身障', '愛心', '陪同', '登出', 'logout']
    user_keywords = settings.get('keywords', [])
    
    for link in ticket_links:
        if link.parent and link.parent.name == 'li':
            text = link.get_text().lower()
            
            # 排除特殊票種
            if any(keyword in text for keyword in exclude_keywords):
                continue
            
            # 檢查是否符合用戶關鍵字
            if user_keywords:
                if not any(keyword.lower() in text for keyword in user_keywords):
                    continue
            
            valid_tickets.append({
                'id': link.get('id'),
                'text': link.get_text().strip(),
                'href': link.get('href', ''),
                'score': calculate_ticket_score(text, user_keywords)
            })
    
    if valid_tickets:
        # 按分數排序，選擇最佳票種
        best_ticket = max(valid_tickets, key=lambda x: x['score'])
        
        return jsonify({
            'action': 'click',
            'selector': f"#{best_ticket['id']}", 
            'message': f'🎫 自動選擇票種: {best_ticket["text"]}'
        })
    
    # 如果沒有符合條件的票種，選擇第一個可用的
    if user_keywords:
        for ticket in ticket_links:
            if ticket.get('id') and ticket.get('id') != 'logoLink':
                return jsonify({
                    'action': 'click',
                    'selector': f"#{ticket.get('id')}",
                    'message': f'🎫 找不到符合條件的票種，選擇第一個可用票種:\n {ticket.get_text().strip()}'
                })
    
    return jsonify({
        'action': 'wait',
        'message': '❌ 很可惜，已經沒有票了，可以再重新整理試試看😭'
    })

def analyze_purchase_page(html_content, url, settings):
    """分析購票頁面，判斷是否要自動提交"""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # 檢查驗證碼輸入框
    verify_code_input = soup.find('input', id='TicketForm_verifyCode')
    if not verify_code_input:
        return jsonify({'action': 'wait', 'message': '等待驗證碼輸入框'})
    
    # 檢查同意條款
    agree_checkbox = soup.find('input', type='checkbox')
    submit_button = soup.find('button', type='submit')
    
    actions = []
    
    # 自動選擇票券數量
    selects = soup.find_all('select')
    ticket_count = settings.get('ticketCount', '1')
    
    for select in selects:
        options = select.find_all('option')
        valid_options = [opt for opt in options if opt.get('value') in ['1', '2', '3', '4']]
        
        if valid_options:
            actions.append({
                'action': 'setValue',
                'selector': f"#{select.get('id')}" if select.get('id') else 'select',
                'value': ticket_count
            })
            break
    
    # 自動勾選同意條款
    if agree_checkbox:
        actions.append({
            'action': 'check',
            'selector': 'input[type="checkbox"]'
        })
    
    # 檢查是否需要填寫驗證碼
    captcha_image = soup.find('img', id='TicketForm_verifyCode-image')
    if captcha_image:
        actions.append({
            'action': 'fillCaptcha',
            'imageUrl': captcha_image.get('src'),
            'inputSelector': '#TicketForm_verifyCode'
        })
    
    # 檢查是否要自動提交
    if (settings.get('autoSubmit', False) and 
        submit_button and 
        verify_code_input and 
        agree_checkbox):
        
        actions.append({
            'action': 'conditionalSubmit',
            'selector': 'button[type="submit"]',
            'conditions': ['captchaFilled', 'agreementChecked']
        })
    
    return jsonify({
        'action': 'execute',
        'actions': actions,
        'message': '準備填寫購票資訊'
    })

def calculate_ticket_score(text, keywords):
    """計算票種分數，用於選擇最佳票種"""
    score = 0
    
    # 基本分數
    score += 1
    
    # 關鍵字匹配加分
    if keywords:
        for keyword in keywords:
            if keyword.lower() in text:
                score += 10
    
    # 價格相關優先級（假設更貴的更好）
    price_match = re.search(r'(\d+)', text)
    if price_match:
        price = int(price_match.group(1))
        score += price / 1000  # 價格越高分數越高
    
    # VIP、搖滾區等特殊區域加分
    special_areas = ['vip', '搖滾', 'rock', '前排', 'front']
    for area in special_areas:
        if area in text:
            score += 5
    
    return score

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)  # 開啟 debug 模式以便查看錯誤