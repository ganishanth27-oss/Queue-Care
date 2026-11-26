Queue Care Hospital - UI Refresh

This refresh changes only frontend styling. Your FastAPI, Supabase, queue, doctor, nurse, admin and SMS logic are kept as-is.

How to use:
1. Back up your current frontend folder.
2. Replace the current frontend/src folder with this package's src folder.
3. Keep your existing frontend/.env file. Do NOT copy secrets from anywhere else.
4. Run:
   npm install
   npm run dev

Backend remains:
cd backend
uvicorn main:app --reload --port 8000

Main UI changes:
- Modern Queue Care Hospital medical theme
- Cleaner authentication and hospital selection screens
- More polished home page cards/buttons
- Patient live queue cards and progress styling
- Nurse dashboard cards and queue items
- Mobile responsive spacing
- No backend/API behavior changed
