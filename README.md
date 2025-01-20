# MatchMate - Backend 🚀

This is the backend for the **MatchMate** matrimony platform, built using the MERN stack. It handles authentication, payment processing, and other functionalities necessary for the platform.

## Technologies Used 💻:
- **Express**: Web framework for Node.js.
- **MongoDB**: NoSQL database to store user data and other platform-related information.
- **Nodemon**: A development tool that automatically restarts the server when file changes are detected.
- **jsonwebtoken (JWT)**: For creating and verifying JSON Web Tokens for secure authentication.
- **Stripe**: Payment gateway integration for handling user payments.
- **dotenv**: Loads environment variables from a `.env` file for configuration.
- **CORS**: Middleware to enable Cross-Origin Resource Sharing.
- **cookie-parser**: Parses cookies attached to the client request.

## Installation ⚙️

### Prerequisites 🔧:
- [Node.js](https://nodejs.org/) (v14 or higher)
- MongoDB account and instance (you can use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) for a cloud-based database)
- Stripe account for payment integration

### Steps to run the backend 🏃‍♂️:
1. Clone this repository:
    ```bash
    git clone https://github.com/your-username/matchmate-backend.git
    cd matchmate-backend
    ```

2. Install the necessary dependencies:
    ```bash
    npm install
    ```

3. Create a `.env` file in the root directory and add the following environment variables:
    ```
    PORT=5000
    MONGO_URI=your_mongodb_connection_string
    JWT_SECRET=your_jwt_secret_key
    STRIPE_SECRET_KEY=your_stripe_secret_key
    ```

4. Run the server in development mode:
    ```bash
    npm run dev
    ```
    This will start the server with Nodemon, and it will automatically restart if you make changes to the code.

5. The server will be running at `http://localhost:5000`. 🌍

## Running Tests 🧪

To run tests (if any are implemented):
```bash
npm start
