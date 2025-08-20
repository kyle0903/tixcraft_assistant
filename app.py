from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from openai import OpenAI
from dotenv import load_dotenv
import time

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
            model="gpt-4.1",
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)  # 開啟 debug 模式以便查看錯誤