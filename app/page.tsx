import React from 'react'
import Rectangle from "./components/upload";
import About from "./components/about";

function page() {
  return (
    <div>
      <main className="Judul">
      <h1>Free Resume/CV ATS Analyzer<br /> Indonesian Version</h1>
      <p>Ingin CV lolos seleksi ATS? Unggah CV kamu sekarang!
        <br /> Dapatkan evaluasi menyeluruh, dan perbesar peluangmu segera dipanggil kerja!
      </p>
        <Rectangle />
        {/* <About /> */}
      </main>
    </div>
  )
}

export default page