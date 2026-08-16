import Image from "next/image"

function Header() {
  return (
    <header className="header">
        <div className="logo"><Image src="/cv.png" alt="Logo" width={60} height={60} /></div>
        <div className="title">MEKANIK CV</div>
     </header>
  )
}

export default Header