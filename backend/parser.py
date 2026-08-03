import re
from bs4 import BeautifulSoup

def parse_html_content(content: bytes) -> dict:
    """
    Parses Belarc HTML report content and extracts the exact 11 requested fields.
    Uses robust regex, lxml parsing, and fallback strategies to support multiple Belarc versions.
    Returns a dictionary ready to be stored as JSON.
    """
    # Using 'lxml' instead of 'html.parser' handles malformed/older HTML much better
    soup = BeautifulSoup(content, 'lxml', from_encoding='utf-8')
    
    # Initialize dictionary with exact requested field names
    data = {
        "Computer Name": "",
        "System Model": "",
        "System Serial Number": "",
        "Physical Address (LAN)": "",
        "Physical Address (Wi-Fi)": "",
        "Virus Protection": "",
        "Operating System": "",
        "Last install": "",
        "Windows Logon": "",
        "Security Benchmark Score": "",
        "Missing Security Updates": ""
    }

    # Helper function to locate section divs by h2/h3/b header
    def get_section_body(header_text):
        for tag in soup.find_all(['h2', 'h3', 'b']):
            if header_text.lower() in tag.get_text().lower():
                # Attempt to find the next sibling div that contains the body
                sibling = tag.find_next_sibling('div')
                if sibling:
                    return sibling
        return None

    # 1. Computer Name & Fallback Windows Logon
    header_table = soup.find('table', class_='reportHeader')
    if header_table:
        for tr in header_table.find_all('tr'):
            th = tr.find('th')
            td = tr.find('td')
            if th and td:
                header_text = th.text.strip().lower()
                if "computer name" in header_text:
                    # Strip domain suffixes safely, e.g., 'AELRZLAP005 (in DOMAIN)'
                    data["Computer Name"] = td.text.split('(in')[0].strip()
                elif "windows logon" in header_text:
                    # Set a fallback just in case the Users table is missing
                    data["Windows Logon"] = td.text.strip()

    # 1b. Override Windows Logon with the True User from the Users table (Highest Logon Count)
    users_body = get_section_body('Users')
    if users_body:
        users_table = users_body.find('table')
        if users_table:
            max_logons = -1
            best_user = ""
            for tr in users_table.find_all('tr'):
                tds = tr.find_all('td')
                if len(tds) >= 2:
                    td_name = tds[1]
                    title = td_name.get('title', '').lower()
                    name = td_name.text.strip()
                    
                    # Skip disabled accounts and system accounts
                    if '[disabled]' not in title and name.lower() not in ['administrator', 'guest', 'defaultaccount', 'wdagutilityaccount', 'system']:
                        # Extract logon count
                        logon_match = re.search(r'number of logons:\s*(\d+)', title)
                        logons = int(logon_match.group(1)) if logon_match else 0
                        
                        if logons > max_logons:
                            max_logons = logons
                            best_user = name
            
            if best_user:
                data["Windows Logon"] = best_user

    # 2. System Model & System Serial Number
    model_body = get_section_body('System Model')
    if model_body:
        lines = list(model_body.stripped_strings)
        if lines:
            data["System Model"] = lines[0].strip()
        for line in lines:
            # Better regex to catch variations like "Machine Serial Number:", "Serial Number ", etc.
            serial_match = re.search(r"Serial Number[:\s]+(.+)", line, re.IGNORECASE)
            if serial_match:
                data["System Serial Number"] = serial_match.group(1).strip()

    # 3. Operating System
    os_body = get_section_body('Operating System')
    if os_body:
        lines = list(os_body.stripped_strings)
        if lines:
            data["Operating System"] = lines[0].strip()

    # 4. Virus Protection
    vp_body = get_section_body('Virus Protection')
    if vp_body:
        vp_table = vp_body.find('table')
        if vp_table:
            current_av = []
            for tr in vp_table.find_all('tr'):
                td = tr.find('td')
                if td:
                    b_tag = td.find('b')
                    if b_tag:
                        if current_av:
                            break # Limit to primary antivirus
                        current_av.append(b_tag.text.strip())
                    else:
                        text = td.get_text(strip=True).replace('\xa0', ' ')
                        # If no <b> tag was found yet, this might be a format without bolding (e.g. MS Defender)
                        if not current_av and text:
                            current_av.append(text)
                            continue
                            
                        if "Virus Definitions Version" in text:
                            text = text.replace("Virus Definitions Version", "").strip()
                        if text:
                            current_av.append(text)
            
            if current_av:
                av_name = current_av[0]
                av_status = ", ".join(current_av[1:])
                data["Virus Protection"] = f"{av_name} ({av_status})" if av_status else av_name

    # 5. Physical Addresses (Smarter Whitelist/Blacklist Extraction)
    comm_body = get_section_body('Communications')
    if comm_body:
        comm_table = comm_body.find('table')
        if comm_table:
            current_adapter = ""
            
            wifi_keywords = ["wireless", "wifi", "wi-fi", "wlan", "802.11", "wireless-ac", "wireless ax", "ax201", "ax210", "9560", "8265"]
            skip_keywords = ["bluetooth", "virtual", "vpn", "loopback", "hyper-v", "vmware", "virtualbox", "pan"]

            for tr in comm_table.find_all('tr'):
                tds = tr.find_all('td')
                if len(tds) == 1 and tds[0].has_attr('colspan'):
                    current_adapter = tds[0].text.lower()
                elif len(tds) >= 3:
                    prop_name = tds[1].text.replace('\xa0', ' ').strip().lower()
                    if "physical address" in prop_name:
                        mac = tds[2].text.strip()
                        
                        # Check if it's a virtual/bluetooth adapter to skip
                        if any(skip_word in current_adapter for skip_word in skip_keywords):
                            continue
                            
                        # Check if it's Wi-Fi
                        if any(wifi_word in current_adapter for wifi_word in wifi_keywords):
                            if not data["Physical Address (Wi-Fi)"]:
                                data["Physical Address (Wi-Fi)"] = mac
                        else:
                            # Default everything else with a MAC address to LAN
                            if not data["Physical Address (LAN)"]:
                                data["Physical Address (LAN)"] = mac

    # 6. Security Benchmark Score (Regex across entire document for resilience)
    full_text = soup.get_text(" ", strip=True)
    benchmark_match = re.search(r'([\d\.]+)\s*of\s*10', full_text)
    if benchmark_match:
        data["Security Benchmark Score"] = f"{benchmark_match.group(1)} of 10"

    # 7. Last install & Missing Security Updates
    missing_body = get_section_body('Missing Security Updates')
    if missing_body:
        text_content = missing_body.get_text(separator=" ", strip=True)
        
        # Regex handles "Last install:" or "Last installed:"
        last_install_match = re.search(r'Last install(?:ed)?:\s*([\d\-]+)', text_content, re.IGNORECASE)
        if last_install_match:
            data["Last install"] = last_install_match.group(1)
        
        missing_updates = []
        # Not relying on tbody; searching all rows directly within the section
        for tr in missing_body.find_all('tr'):
            tds = tr.find_all('td')
            if len(tds) >= 3:
                # Capture both KB ID (tds[0]) and Description (tds[2])
                kb_id = tds[0].get_text(separator=" ", strip=True)
                desc = tds[2].get_text(separator=" ", strip=True)
                
                # Clean up known prefixes if they exist
                if kb_id.lower() == 'eol-microsoft':
                    kb_id = 'EOL'
                    
                missing_updates.append(f"{kb_id} - {desc}")
                
        if missing_updates:
            data["Missing Security Updates"] = " | ".join(missing_updates)

    return data