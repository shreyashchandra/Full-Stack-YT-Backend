import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiEroor } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
  // Get user deatils from the frontend
  // validation- not empty
  // check if user already exists: username, email
  // check for images, check for avatar
  // upload them to cloudinary, avatar
  // create user object - create entry in db
  // remove password and refresh token field from response
  // check for user creation
  // return response

  const { username, email, fullName, password } = req.body;

  // BAD WAY TO VALIDATE
  // if (fullName === "") {
  //   throw new ApiEroor(400, "fullname is required");
  // }

  // GOOD WAY TO VALIDATE
  if (
    [username, email, fullName, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiEroor(400, "All fields are required");
  }

  // check if user already exists: username, email
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiEroor(409, "username or email allready exists");
  }

  // Uploding file on local using MULTER
  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;

  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files?.coverImage[0]?.path;
  }

  // File validation local
  if (!avatarLocalPath) {
    throw new ApiEroor(400, "Avatar file is required");
  }

  // UPLOADING FILE FROM LOCAL TO CLOUDINARY
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  // FILE VALIDATION
  if (!avatar) {
    throw new ApiEroor(400, "Avatar required");
  }

  // CREATING OBJ IN DB

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    username: username.toLowerCase(),
    email,
    password,
  });

  const userCreated = await User.findById(user._id).select(
    "-password -refreshToken "
  );

  if (!userCreated) {
    throw new ApiEroor(500, "Somthing went wrong while registering!!");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, userCreated, "User registered Successfully !"));
});

export { registerUser };
