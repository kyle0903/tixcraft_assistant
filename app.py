from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from openai import OpenAI
from dotenv import load_dotenv
import base64
import time

# 載入環境變數
load_dotenv()

app = Flask(__name__)
CORS(app)  # 允許跨域請求
# 初始化 OpenAI 客戶端
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

@app.route('/')
def index():
    print("Hello, Worlds!")
    return jsonify({'message': 'Hello, World!'})

@app.route('/login', methods=['GET'])
def login():
    return jsonify({'message': 'login!'})

# 測試圖片轉換base64
@app.route('/test-image', methods=['POST'])
def test_image():
    # 上傳圖片
    file = request.files['file']
    base64_image = base64.b64encode(file.read()).decode('utf-8')

    return jsonify({'image': base64_image})

@app.route('/analyze-image', methods=['POST'])
def analyze_image():
    try:
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
                            "text": """妳是驗證碼識別專家，請根據以下規則分析:
                            1. 幫我分析這張圖片的內容,回傳圖片的文字就好，不要有任何其他文字
                            2. 回傳的文字必須是四個小寫英文字母
                            3. r的右邊會有一個小尾巴，會很像p，請特別注意
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
        print(f"Error: {str(e)}")  # 添加錯誤日誌
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)  # 開啟 debug 模式以便查看錯誤