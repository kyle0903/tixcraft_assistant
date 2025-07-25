import requests
from bs4 import BeautifulSoup
import json

class TicketScraper:
    def __init__(self, print_callback=None):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        self.print_callback = print_callback

    def _print(self, msg):
        if self.print_callback:
            self.print_callback(str(msg))
        else:
            print(msg)

    def get_ticket_urls(self, url, arr_keyword, is_default):
        concert_name = url.split("/")[-1]
        while True:
            response = self._make_request(url)
            if not response:
                return "無法連接到網站"
            
            href = self._extract_buy_link(response)
            if href:
                ticket_number= self._get_ticket_number(href)
  
                if not ticket_number:
                    self._print("重新取得購票連結中...")
                    continue
                if isinstance(ticket_number, str):
                    self._print(ticket_number)
                    continue
                for number in ticket_number:
                    ticket_result = self._get_ticket_enter_url(concert_name, number, arr_keyword)
                    # ticket_result 可能是 dict 或 {"找不到符合條件的票種":"(空)"}
                    if isinstance(ticket_result, dict) and list(ticket_result.values())[0] != "(空)":
                        return [ticket_result]
                    if is_default == "n":
                        break
                return "找不到符合條件的票種或無票"

    def _make_request(self, url):
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            return BeautifulSoup(response.text, 'html.parser')
        except requests.RequestException as e:
            print(f"請求錯誤: {e}")
            return None

    def _extract_buy_link(self, soup):
        if not soup:
            return None
        for li in soup.find_all('li'):
            if li.get('class') == ['buy']:
                a_tag = li.find('a')
                if a_tag and a_tag.get('href'):
                    return "https://tixcraft.com" + a_tag.get('href')
        return None

    def _get_ticket_number(self, url):
        if not url:
            return None
        soup = self._make_request(url)
        if not soup:
            return None
        arr_button = []
        for button in soup.find_all('button'):
            if button.get('class') == ['btn', 'btn-primary', 'text-bold', 'm-0']:
                arr_button.append(button.get('data-href').split("/")[-1])
        if len(arr_button) == 0:
            for tr in soup.find_all('tr'):
                if tr.get('class') == ['gridc', 'fcTxt']:
                    for div in tr.find_all('div'):
                        if div.get('class') == ['text-center']:
                            self._print(div.text.strip())
                            return div.text.strip()
            return None
        return arr_button

    def _get_ticket_enter_url(self, concert_name, number, arr_keyword):
        if not number:
            return "找不到票號"
        
        url = f"https://tixcraft.com/ticket/area/{concert_name}/{number}"
        # request url
        response = self._make_request(url)
        if "areaUrlList" not in str(response):
            return {"直接購票":url}
   
        urls = self._find_ticket_urls_with_keyword(url, arr_keyword)
        print("----------------------------------------------------")
        
        if not urls:
            return {"找不到符合條件的票種":"(空)"}
        
        return urls

    def _find_ticket_urls_with_keyword(self, url, arr_keyword):
        soup = self._make_request(url)
        if not soup:
            return None

        matching_tickets = {}
        exclude_keywords = ['wheelchair', '身障', '愛心', '陪同']
        for li in soup.find_all('li'):
            li_text = li.text.lower()
            # 排除身障、愛心、陪同票種
            if any(ex_kw in li_text for ex_kw in exclude_keywords):
                continue
            if arr_keyword:
                keywords_match = any(keyword.lower() in li.text.lower() for keyword in arr_keyword)
            else:
                keywords_match = True
            if keywords_match:
                a_tag = li.find('a')
                if a_tag and a_tag.get('id'):
                    ticket_id = a_tag.get('id')
                    ticket_text = li.text.strip()
                    matching_tickets[ticket_id] = ticket_text
        if not matching_tickets:
            return None

        url_dict = self._extract_area_url_list(soup)
        if not url_dict:
            return None

        return {text: url_dict[ticket_id] 
                for ticket_id, text in matching_tickets.items() 
                if ticket_id in url_dict}

    def _extract_area_url_list(self, soup):
        for script in soup.find_all('script'):
            if script.string and 'areaUrlList' in script.string:
                try:
                    json_str = script.string.split('var areaUrlList = ')[1].split(';')[0]
                    return json.loads(json_str)
                except (json.JSONDecodeError, IndexError) as e:
                    self._print(f"解析 areaUrlList 時發生錯誤: {e}")
                    return None
        return None
