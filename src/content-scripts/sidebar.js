async function getPrompts() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get({'prompts': []}, function (data) {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            }
            else {
                resolve(data.prompts.reverse()); // returning reverse because of bad setup; means you should set reverse as well
            }
        });
    });
}

async function getTranslations() {
    return new Promise(async (resolve) => {
        chrome.storage.local.get({ lang: "en" }, async function (result) {
            console.log("inserting!");
            const lang = result.lang ?? "en";
            const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
            const response = await fetch(url);
            const translations = await response.json();
            resolve(translations);
        });
    });
}
async function main() {
    let prompts = await getPrompts()
    const translations = await getTranslations()
    console.log(await translations)
    const t = await translations
    const promptBar = // styles from chatbotui.com (MIT - Mckay Wrigley)
        `
<div id="prompt-bar" class="flex h-full flex-1 flex-col space-y-1 p-2" style="position:fixed; z-index: 1; right:0; width:260px; background-color: #202123">
  <div class="flex items-center">
    <button style="width: 190px;"class="flex text-white text-sm flex-shrink-0 items-center gap-3 rounded-md border hover:bg-gray-500/10 border-white/20 p-3 text-white">
      ${svg("plus")} ${tr("new_prompt", t)}</button>
    <button class="flex items-center flex-shrink-0 gap-3 p-3 ml-2 text-sm text-white transition-colors duration-200 border rounded-md cursor-pointer border-white/20 hover:bg-gray-500/10">
      ${svg("folder")}
    </button>
  </div>
  <div class="relative flex items-center">
    <input class="w-full flex-1 rounded-md border border-neutral-600 px-4 py-3 pr-10 text-[14px] leading-3 text-white" type="text" placeholder='${tr("search_prompts", t)}' value="" style="background-color: #202123">
  </div>
  <div class="flex-grow overflow-auto">
    <div class="pt-2">
      <div class="flex w-full flex-col gap-1" id="sidebarPrompts">
        <!--begin prompt column template-->
        ${prompts.map((prompt) => `
            <div class="relative flex items-center">
                <button data-prompt-id="${prompt.id}" class="edit-prompts pgbtn flex w-full text-white cursor-pointer items-center gap-3 rounded-lg p-3 text-sm transition-colors duration-200 hover:bg-500/10" draggable="true">
                    ${svg("lightbulb")}
                    <div data-prompt-id2="${prompt.id}" style="font-size: 12.5px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 165px" class="relative max-h-5 flex-1 overflow-hidden text-ellipsis whitespace-nowrap break-all pr-4 text-left text-[12.5px] leading-3">${prompt.title}</div>
                </button>
                <div class="absolute right-1 z-10 flex text-gray-300">
                    <button style="min-width: 20px" class="p-1 text-neutral-400 svg-hover">
                        ${svg('trash')}
                    </button>
                </div>
            </div>`).join(" ")}
        <!-- end prompt column template-->
      </div>
    </div>
  </div>
</div>
<button id="closePrompt" style="position: absolute; z-index: 1; bottom: 0; right: 259px; background-color: #202123; width: 28px; height: 28px; color: white; border-top-left-radius: 5px; border-bottom-left-radius: 3px;">></button>
`
    let nav = (document.querySelector("nav")).parentElement.parentElement.parentElement
    nav.id = "navbar"
    nav = document.getElementById("navbar")
    const mainPar = document.querySelector("main").parentElement
    const closeNavButton = `<button id="closeNav" style="position: absolute; z-index: 1; bottom: 0; left: 259px; background-color: #202123; width: 28px; height: 28px; color: white; border-top-right-radius: 5px; border-bottom-right-radius: 3px;"><</button>`
    nav.insertAdjacentHTML("afterend", promptBar)
    nav.insertAdjacentHTML("afterend", closeNavButton)
    mainPar.style.marginRight = "220px"

    function addStyles(){
        const styles = `<style>.pgbtn:hover{background-color: rgba(52,53,65,.9)};.svg-hover:hover{color: #F5F5F5!important;}</style>`
        document.head.insertAdjacentHTML("beforeend", styles)
    }
    addStyles()

    function toggleNav() {
        const hidden = nav.style.display === "none"
        const closeNavBut = document.getElementById("closeNav")
        if (hidden) {
            nav.style.display = "block"
            closeNavBut.style.left = "259px"
            closeNavBut.innerHTML = "<"
        } else {
            nav.style.display = "none"
            closeNavBut.style.left = "0"
            closeNavBut.innerHTML = ">"
        }
    }

    async function editPrompt(id){
        console.log(id)
        let newP = await getPrompts()
        let prompt = newP[getObjectIndexByID(id, newP)]
        console.log(prompt)
        const html = getPromptModal(prompt.id, prompt?.title ?? "", prompt?.text ?? "",  prompt?.tags?.join(",") ?? "")
        nav.insertAdjacentHTML("beforeend", html)
        document.getElementById("prompt-category").value = prompt?.category ?? ""
        document.getElementById("save-prompt").addEventListener("click", () => updatePrompt(id))
    }

    async function updatePrompt(id) {
        console.log("updating prompt " + id)
        let newP = await getPrompts();
        let promptIndex = getObjectIndexByID(id, newP);
        let title;
        if (promptIndex !== -1) { // Ensure a valid index is returned by getObjectIndexByID function
            title = document.getElementById("prompt-name").value
            newP[promptIndex].title = title;
            console.log(document.getElementById("prompt-text").value)
            newP[promptIndex].text = document.getElementById("prompt-text").value;
            newP[promptIndex].tags = document.getElementById("prompt-tags").value.split(",");
            newP[promptIndex].category = document.getElementById("prompt-category").value;
            newP[promptIndex].lastChanged = new Date().getTime()
            console.log(newP)
            chrome.storage.local.set({prompts: newP.reverse()});
        }
        document.getElementById("prompt-modal").remove()
        const btn = document.querySelector(`[data-prompt-id2='${id}']`)
        btn.innerHTML = title
    }

    function addEvents(){
        let ep = document.querySelectorAll(".edit-prompts");
        for (let prompt of ep) {
            prompt.addEventListener("click", (event) => {
                let t = event.target
                while (!t.dataset.promptId){
                    t = t.parentElement
                }
                let promptId = t.dataset.promptId; // Get the data-prompt-id value
                console.log("CLICK!")
                editPrompt(promptId); // Pass the promptId as a parameter to editPrompt function
            });
        }
    }
    addEvents()

    function getPromptModal(id="", name="", text="", tags=""){
        const template = `
    <div id="prompt-modal" data-prompt-id="${id}" style="z-index: 100; background-color: rgb(0 0 0/.5)" class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-100">
        <div class="fixed inset-0 z-10 overflow-y-auto">
            <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div class="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true"></div>
                <div
                    class="dark:border-netural-400 inline-block max-h-[400px] transform overflow-hidden rounded-lg border border-gray-300 bg-white px-4 pt-5 pb-4 text-left align-bottom shadow-xl transition-all dark:bg-[#202123] sm:my-8 sm:max-h-[600px] sm:w-full sm:max-w-lg sm:p-6 sm:align-middle"
                    role="dialog">
                    <div class="text-sm font-bold text-black dark:text-neutral-200">${tr("name", t)}</div>
                    <input id="prompt-name" value="${name}" class="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100" placeholder="A name for your prompt." value="">
                        <div class="mt-6 text-sm font-bold text-black dark:text-neutral-200">${tr("prompt", t)}</div>
                        <textarea id="prompt-text"
                            class="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                            placeholder="Prompt content. Use {{}} to denote a variable. Ex: {{name}} is a {{adjective}} {{noun}}"
                            rows="10" style="resize: none;" spellCheck="false">${text}</textarea> <br>
                    <div class="text-sm font-bold text-black dark:text-neutral-200">${tr("tags", t)}</div>
                    
                    <input id="prompt-tags" value="${tags}" class="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100" placeholder="Tags for your prompt. Separate with a comma." value="">
                    <div class="mt-6 text-sm font-bold text-black dark:text-neutral-200">${tr("category", t)}</div>
                    <div style="">
                        <select id="prompt-category" class="border border-neutral-500 text-sm rounded block w-full">
                            <option value="" data-i18n="all_categories">Select</option>
                            <option value="Academic Writing" data-i18n="category_academic_writing">Academic Writing</option>
                            <option value="Bypass & Personas" data-i18n="category_bypass_personas">Bypass &amp; Personas</option>
                            <option value="Education & Learning" data-i18n="category_education_learning">Education &amp; Learning</option>
                            <option value="Expert/Consultant" data-i18n="category_expert_consultant">Expert/Consultant</option>
                            <option value="Fun & Games" data-i18n="category_fun_games">Fun &amp; Games</option>
                            <option value="Fitness, Nutrition, & Health" data-i18n="category_fitness_nutrition_health">Fitness, Nutrition, &amp; Health</option>
                            <option value="Fiction Writing" data-i18n="category_fiction_writing">Fiction Writing</option>
                            <option value="Music" data-i18n="category_music">Music</option>
                            <option value="Nonfiction Writing" data-i18n="category_nonfiction_writing">Nonfiction Writing</option>
                            <option value="Other" data-i18n="category_other">Other</option>
                            <option value="Philosophy & Logic" data-i18n="category_philosophy_logic">Philosophy &amp; Logic</option>
                            <option value="Poetry" data-i18n="category_poetry">Poetry</option>
                            <option value="Programming & Technology" data-i18n="category_programming_technology">Programming &amp; Technology</option>
                            <option value="Speeches & Scripts" data-i18n="category_speeches_scripts">Speeches &amp; Scripts</option>
                            <option value="Social Media & Blogging" data-i18n="category_social_media_blogging">Social Media &amp; Blogging</option>
                            <option value="Travel" data-i18n="category_travel">Travel</option>
                            <option value="Therapy & Life-help" data-i18n="category_therapy_life_help">Therapy &amp; Life-help</option>
                        </select>
                    </div>
                        <!--div class="mt-6 text-sm font-bold text-black dark:text-neutral-200">$ {tr("description", t)}</div>
                        <textarea
                            class="mt-2 w-full rounded-lg border border-neutral-500 px-4 py-2 text-neutral-900 shadow focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-[#40414F] dark:text-neutral-100"
                            placeholder="A description for your prompt." rows="3" style="resize: none;"></textarea-->
                        <button id="save-prompt" type="button"
                                class="w-full px-4 py-2 mt-6 border rounded-lg shadow border-neutral-500 text-neutral-900 hover:bg-neutral-100 focus:outline-none dark:border-neutral-800 dark:border-opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-300">Save
                        </button></div>
            </div>
        </div>
    </div>
    `
        return template
    }

    function togglePrompt() {
        const myNav = document.getElementById("prompt-bar")
        const hidden = myNav.style.display === "none"
        const closePrompt = document.getElementById("closePrompt")
        if (hidden) {
            myNav.style.display = "block"
            closePrompt.style.right = "259px"
            closePrompt.innerHTML = ">"
            mainPar.style.marginRight = "259px"
        } else {
            myNav.style.display = "none"
            closePrompt.style.right = "0"
            closePrompt.innerHTML = "<"
            mainPar.style.marginRight = "0"
        }

    }

    document.getElementById("closeNav").addEventListener("click", toggleNav)
    document.getElementById("closePrompt").addEventListener("click", togglePrompt)
}
setTimeout(main, 1000)

function svg(name){
    switch(name){
        case "lightbulb" : return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-bulb-filled"><path d="M4 11a1 1 0 0 1 .117 1.993l-.117 .007h-1a1 1 0 0 1 -.117 -1.993l.117 -.007h1z" fill="currentColor" stroke-width="0"></path><path d="M12 2a1 1 0 0 1 .993 .883l.007 .117v1a1 1 0 0 1 -1.993 .117l-.007 -.117v-1a1 1 0 0 1 1 -1z" fill="currentColor" stroke-width="0"></path><path d="M21 11a1 1 0 0 1 .117 1.993l-.117 .007h-1a1 1 0 0 1 -.117 -1.993l.117 -.007h1z" fill="currentColor" stroke-width="0"></path><path d="M4.893 4.893a1 1 0 0 1 1.32 -.083l.094 .083l.7 .7a1 1 0 0 1 -1.32 1.497l-.094 -.083l-.7 -.7a1 1 0 0 1 0 -1.414z" fill="currentColor" stroke-width="0"></path><path d="M17.693 4.893a1 1 0 0 1 1.497 1.32l-.083 .094l-.7 .7a1 1 0 0 1 -1.497 -1.32l.083 -.094l.7 -.7z" fill="currentColor" stroke-width="0"></path><path d="M14 18a1 1 0 0 1 1 1a3 3 0 0 1 -6 0a1 1 0 0 1 .883 -.993l.117 -.007h4z" fill="currentColor" stroke-width="0"></path><path d="M12 6a6 6 0 0 1 3.6 10.8a1 1 0 0 1 -.471 .192l-.129 .008h-6a1 1 0 0 1 -.6 -.2a6 6 0 0 1 3.6 -10.8z" fill="currentColor" stroke-width="0"></path></svg>`
        case "folder" : return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-folder-plus"> <path d="M12 19h-7a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2h4l3 3h7a2 2 0 0 1 2 2v3.5"></path> <path d="M16 19h6"></path> <path d="M19 16v6"></path> </svg>`;
        case "trash" : return  `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-trash"> <path d="M4 7l16 0"></path> <path d="M10 11l0 6"></path> <path d="M14 11l0 6"></path> <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"></path> <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"></path> </svg>`
        case "plus" : return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-plus"> <path d="M12 5l0 14"></path> <path d="M5 12l14 0"></path> </svg>`
    }
}