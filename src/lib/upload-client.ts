import { nahratFotkuPriamo } from '@/lib/upload-client';

// Při výběru nebo odeslání fotky:
async function handlePhotoUpload(file: File) {
  try {
    // Zkomprimuje fotku na ~300 KB a pošle ji přímo na appbpyes.cz/fotky/upload.php
    const photoUrl = await nahratFotkuPriamo(file);
    console.log('Fotka úspěšně uložena na URL:', photoUrl);
    
    // Zde uložte photoUrl do stavu/databáze
  } catch (error: any) {
    alert(`Nahrávání selhalo: ${error.message}`);
  }
}
