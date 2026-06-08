## ⚡ ! !   𝐌𝐎𝐒𝐓𝐀𝐊𝐈𝐌 𝐕𝟐 𝐁𝐎𝐓   ! !   ⚡

<br />
<p align="center">
    <a href="https://github.com/mostakim-sagor/MOSTAKIM-V2-BOT">
        <img src="https://i.imgur.com/cziEPNJ.png" alt="Logo">
    </a>

<!-- Typing Animation -->
<p align="center">
  <img src="https://readme-typing-svg.herokuapp.com?font=JetBrains+Mono&size=22&duration=3000&pause=1000&color=00A8FF&center=true&vCenter=true&width=500&lines=Assalamualaikum+Everyone!;Welcome+To+MOSTAKIM+V2+BOT" />
</p>


   ❖ **`A simple Facebook Messenger Bot made by md mostakim  islam sagor`**   
   
<p align="center">

  <a href="https://github.com/mostakim-sagor/MOSTAKIM-V2-BOT/issues">
    <img src="https://img.shields.io/badge/Report-Bug-red?style=flat-square">
  </a>

  <a href="https://github.com/mostakim-sagor/MOSTAKIM-V2-BOT/issues/new">
    <img src="https://img.shields.io/badge/Request-Feature-blue?style=flat-square">
  </a>

</p>


<p align="center">
  
  <img alt="size" src="https://img.shields.io/github/repo-size/mostakim-sagor/MOSTAKIM-V2-BOT?style=flat-square&label=size">

  <img alt="bot-version" src="https://img.shields.io/badge/dynamic/json?color=red&label=bot%20version&prefix=v&query=%24.version&url=https%3A%2F%2Fraw.githubusercontent.com%2Fmostakim-sagor%2FMOSTAKIM-V2-BOT%2Fmain%2Fpackage.json&style=flat-square">

  <a href="https://github.com/mostakim-sagor/MOSTAKIM-V2-BOT/commits/main">
    <img alt="commits" src="https://img.shields.io/github/commit-activity/m/mostakim-sagor/MOSTAKIM-V2-BOT?label=commit&style=flat-square">
  </a>

  <img alt="visitors" src="https://visitor-badge.laobi.icu/badge?page_id=mostakim-sagor.MOSTAKIM-V2-BOT&style=flat-square">

</p>



<!-- TABLE OF CONTENTS -->
<details open="open">
    <summary>Table of Contents</summary>
    <ol>
        <li><a href="#installation">Installation Guide</a></li>
        <li><a href="#contributing">Contributing</a></li>
        <li><a href="#license">License</a></li>
        <li><a href="#contact">Contact</a></li>
    </ol>
</details>


<!-- INSTALLATION -->
## Installation

Below are the basic steps to install and run the bot.

## Requirements

- Your device should have at least 1-2GB free storage.
- A file editor is recommended:
  - [Notepad++](https://notepad-plus-plus.org/downloads/)
  - [Sublime Text 3](https://www.sublimetext.com/3)
- Basic knowledge of Node.js and JavaScript.
- A Facebook account for the bot.
- For:
    - Windows: Install windows-build-tools.
    - Linux: Install python3 or python2.
    - Android: Use Termux to run the bot.

## ⚙️  Installation

###  💻 Windows

1. Download and install:
   - [Node.js](https://nodejs.org/en/)
   - [Git](https://git-scm.com/)

2. Install windows-build-tools:
     ```sh
     npm install windows-build-tools
     ```

3. Clone the bot source code:
    ```sh
    git clone https://github.com/mostakim-sagor/MOSTAKIM-V2-BOT.git
    ```

4. Install required packages:
    ```sh
    npm install
    ```

5. Edit the config file:
    - Open `config.json`
    - Edit email, password, bot name, and other settings
    - Save the file

6. Get appstate:
    ```sh
    node login
    ```

7. Start the bot:
    ```sh
    npm start
    ```

---

## 📱  Android

1. Install Termux from Google Play Store.

2. Open Termux and run:
    ```sh
    termux-setup-storage && apt update && apt upgrade && pkg install curl -y && bash <(curl -s https://raw.githubusercontent.com/mostakim-sagor/storage-data/master/install.sh)
    ```

3. Wait for all packages and libraries to finish installing.

4. Get appstate:
    ```sh
    node login
    ```

5. Run the bot:
    ```sh
    cd ./MOSTAKIM-V2-BOT && npm start
    ```

---

##  🖥️ Linux / Ubuntu

1. Install Node.js and Git:
    ```sh
    sudo apt-get install curl
    curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install nodejs git sqlite3 -y
    sudo npm install -g npm
    ```

2. Clone the bot source:
    ```sh
    git clone https://github.com/mostakim-sagor/MOSTAKIM-V2-BOT.git
    ```

3. Install required packages:
    ```sh
    npm install
    ```

4. Edit config:
    - Open `config.json`
    - Configure the bot settings

5. Get appstate:
    ```sh
    node login
    ```

6. Start the bot:
    ```sh
    npm start
    ```

---

## 🚀 Deployments

| **Status** | **Action** |
|-----------|------------|
| ![Replit](https://img.shields.io/badge/Replit-F26D00?style=for-the-badge&logo=replit&logoColor=white) | [![Deploy](https://img.shields.io/badge/DEPLOY-CLICK%20HERE-blue?style=for-the-badge)](https://replit.com) |
| ![Render](https://img.shields.io/badge/Render-3FE0C5?style=for-the-badge&logo=render&logoColor=black) | [![Deploy](https://img.shields.io/badge/DEPLOY-CLICK%20HERE-blue?style=for-the-badge)](https://render.com) |
| ![Railway](https://img.shields.io/badge/Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white) | [![Deploy](https://img.shields.io/badge/DEPLOY-CLICK%20HERE-blue?style=for-the-badge)](https://railway.app) |

## Installation Video Tutorials

1. Windows: Tutorial Coming Soon
2. Linux: Tutorial Coming Soon
3. Android: Tutorial Coming Soon

<!-- CONTRIBUTING -->
## ❇️  Contributing

Your contributions help make the project better. Steps to contribute:

1. Fork this project
2. Create a new branch for your feature:
```sh
git checkout -b feature/AmazingFeature
```

3. Commit your changes:
```sh
git commit -m "Add some AmazingFeature"
```

4. Push the branch:
```sh
git push origin feature/AmazingFeature
```

5. Create a new Pull Request

<!-- LICENSE -->
##  📃 License

This project is licensed under the GNU General Public License v3.0 License - see the [LICENSE](LICENSE) file.

<!-- CONTACT -->

##  📞 Contact

<p align="center">
  
  <a href="https://fb.me/100058112936375">
    <img src="https://img.shields.io/badge/Facebook-1877F2?style=for-the-badge&logo=facebook&logoColor=white" />
  </a>

  <a href="https://github.com/mostakim-sagor">
    <img src="https://img.shields.io/badge/GitHub-121011?style=for-the-badge&logo=github&logoColor=white" />
  </a>

  <a href="https://t.me/M0STAKIM10X">
    <img src="https://img.shields.io/badge/Telegram-26A5E4?style=for-the-badge&logo=telegram&logoColor=white" />
  </a>

  <a href="https://youtube.com/@MOSTAKIM-LABS">
    <img src="https://img.shields.io/badge/YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white" />
  </a>

  <a href="https://instagram.com/mostakim.info">
    <img src="https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white" />
  </a>

</p>