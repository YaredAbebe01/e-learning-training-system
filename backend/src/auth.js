const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET in environment variables.");
}

function signToken(user) {
  const userId = user.id || user._id;
  const email = user.email;
  const role = user.role;
  const name = user.full_name || user.name || user.email;

  return jwt.sign(
    {
      id: userId ? String(userId) : undefined,
      email,
      role,
      name,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function authMiddleware(requiredRole) {
  return (req, res, next) => {
    const token = req.cookies?.auth_token || req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload;
      if (requiredRole && payload.role !== requiredRole) {
        return res.status(403).json({ error: "Forbidden" });
      }
      return next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}

module.exports = { signToken, authMiddleware };