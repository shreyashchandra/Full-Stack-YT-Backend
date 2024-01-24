import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiEroor } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessTokenAndRefreshToken = async (userid) => {
  try {
    const user = await User.findById(userid);
    const accessToekn = user.generateAccessToken(userid);
    const refreshToken = user.generateRefreshToken(userid);

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToekn, refreshToken };
  } catch (error) {
    throw new ApiEroor(500, "Somthing went wrong while generating token!");
  }
};

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

const loginUser = asyncHandler(async (req, res) => {
  // req body -> data
  // check username or email
  // find the user
  // password check
  // access and refresh token
  // send cooki
  // -------------------------------------------------

  // taking input from user
  const { email, username, password } = req.body;

  // finding the user
  if (!username && !email) {
    throw new ApiEroor(400, "username or email is required");
  }
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (!user) {
    throw new ApiEroor(400, "user doesn't exsit!");
  }

  // check password
  const isValidPassword = await user.isPasswordCorrect(password);
  if (!isValidPassword) {
    throw new ApiEroor(401, "invalid password");
  }

  // access and refresh token
  const { accessToekn, refreshToken } =
    await generateAccessTokenAndRefreshToken(user._id);

  // to get loged in user data
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // Send token as cookie
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToekn", accessToekn, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToekn,
          refreshToken,
        },
        "User logged In Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToekn", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiEroor(401, "unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiEroor(401, "invalid refresh token");
    }

    if (incomingRefreshToken != user?.refreshToken) {
      throw new ApiEroor(401, "refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToekn, newRefreshToken } =
      await generateAccessTokenAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToekn", accessToekn, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToekn, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiEroor(401, error?.message || "invalid refresh token");
  }
});

export { registerUser, loginUser, logoutUser, refreshAccessToken };
