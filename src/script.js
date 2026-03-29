function switchTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

        const targetTab = document.getElementById('tab-' + tabName);
        const targetBtn = document.getElementById('btn-' + tabName);

        if (targetTab && targetBtn) {
            targetTab.classList.add('active');
            targetBtn.classList.add('active');
            targetTab.querySelectorAll('pre code').forEach((block) => {
                    block.classList.remove('prism-highlighted');
                    Prism.highlightElement(block);
            });
        }

        if (tabName === 'download') {
            fetchVersions();
        }
}

async function fetchVersions() {
    const list = document.getElementById('version-list');
    if (list.querySelector('.version-card')) return;

    list.innerHTML = '<div class="loader">Connecting to GitHub...</div>';

    try {
        const response = await fetch('https://api.github.com/repos/javascript-system/tortoise/contents/package');

        if (!response.ok) throw new Error("404");

        const data = await response.json();
        const versions = data.filter(item => item.type === 'dir' && item.name.startsWith('tortoise-v-'));

        if (versions.length === 0) throw new Error("No folders found");

        versions.sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));

        list.innerHTML = versions.map(v => `
            <div class="version-card">
                <strong>${v.name}</strong>
                <button class="btn-dl" id="btn-dl-${v.name}" onclick="downloadVersion('${v.name}')">Download .zip</button>
            </div>
        `).join('');

    } catch (err) {
        list.innerHTML = `
            <div class="error-box">
                <strong>Error: versions not found (404)</strong>
                <p style="font-size: 0.8rem; margin-top:5px;">Could not fetch packages from the specified repository path.</p>
            </div>
        `;
    }
}

async function downloadVersion(versionName) {
    const btn = document.getElementById(`btn-dl-${versionName}`);
    const originalText = btn.innerText;

    btn.innerText = "Zipping...";
    btn.disabled = true;

    try {
        const repoUrl = `https://api.github.com/repos/javascript-system/tortoise/contents/package/${versionName}`;
        const res = await fetch(repoUrl);
        if (!res.ok) throw new Error("Could not fetch folder contents.");

        const files = await res.json();

        const zipWriter = new zip.ZipWriter(new zip.BlobWriter("application/zip"));
        for (const file of files) {
            if (file.type === 'file') {
                const fileReq = await fetch(file.download_url);
                const fileBlob = await fileReq.blob();
                await zipWriter.add(file.name, new zip.BlobReader(fileBlob));
            }
        }

        const blob = await zipWriter.close();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${versionName}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (e) {
        alert("Download error: " + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

window.onload = () => {
    if (typeof Prism !== 'undefined') {
        Prism.highlightAll();
    }
};